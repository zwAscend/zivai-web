import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DevelopmentPlan, Student, Step } from '../../types';
import {
  BookOpen,
  CheckCircle,
  Edit,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  Video,
} from 'lucide-react';
import { aiTutorService, AiTutorMessage, AiTutorSession } from '../../services/aiTutorService';
import { fetchData } from '../../services/http';

interface StudentPlanViewProps {
  plan: DevelopmentPlan;
  student: Student;
  onOpenTutor?: (prompt?: string) => void;
}

interface ResourceSummary {
  id: string;
  name: string;
  originalName?: string | null;
  mimeType?: string | null;
  url?: string | null;
  contentBody?: string | null;
}

type StepMaterial =
  | { kind: 'resource'; resource: ResourceSummary }
  | { kind: 'url'; url: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (progress >= 60) return 'bg-blue-500';
  if (progress >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
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

const StudentPlanView: React.FC<StudentPlanViewProps> = ({ plan, student, onOpenTutor }) => {
  const sortedSteps = useMemo(
    () => plan.plan.steps?.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) || [],
    [plan.plan.steps]
  );

  const totalSteps = sortedSteps.length;
  const completedStepsCount = Math.floor((plan.currentProgress / 100) * totalSteps);

  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [stepWorkspaceNotes, setStepWorkspaceNotes] = useState<Record<number, string>>({});

  const [session, setSession] = useState<AiTutorSession | null>(null);
  const [messages, setMessages] = useState<AiTutorMessage[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedStep = sortedSteps[selectedStepIndex] || null;

  useEffect(() => {
    if (selectedStepIndex > sortedSteps.length - 1) {
      setSelectedStepIndex(Math.max(sortedSteps.length - 1, 0));
    }
  }, [selectedStepIndex, sortedSteps.length]);

  useEffect(() => {
    if (!student?.id || !plan?.plan?.subjectId) {
      setSession(null);
      setMessages([]);
      return;
    }

    let isActive = true;
    setIsAiLoading(true);
    setAiError(null);

    (async () => {
      const nextSession = await aiTutorService.getOrCreateSession(student.id, plan.plan.subjectId, student.id);
      if (!isActive) return;

      setSession(nextSession);
      const chatMessages = await aiTutorService.listMessages(nextSession.id);
      if (!isActive) return;

      setMessages((chatMessages || []).slice(-40));
    })()
      .catch((err: any) => {
        if (!isActive) return;
        setAiError(err?.message || 'Failed to initialize plan collaborator.');
      })
      .finally(() => {
        if (isActive) {
          setIsAiLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [student?.id, plan?.plan?.subjectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  const buildStepPrompt = (step: Step, intent: 'explain' | 'practice' | 'reasoning' | 'hint') => {
    const stepNotes = (stepWorkspaceNotes[selectedStepIndex] || '').trim();
    const notesBlock = stepNotes ? `\nMy attempt so far:\n${stepNotes}` : '';

    if (intent === 'practice') {
      return `Give me one practice question for "${step.title}". Do not provide the final answer. Guide with hints after I attempt.${notesBlock}`;
    }
    if (intent === 'reasoning') {
      return `I am working on "${step.title}". Review my reasoning and ask probing questions instead of solving it for me.${notesBlock}`;
    }
    if (intent === 'hint') {
      return `I am stuck on "${step.title}". Give me one next hint only, then ask what I think the next move should be.${notesBlock}`;
    }
    return `Explain the concept behind "${step.title}" in a guided way. Ask me to restate the key idea in my own words.${notesBlock}`;
  };

  const handleSendPrompt = async (overridePrompt?: string) => {
    const prompt = (overridePrompt || aiPrompt).trim();
    if (!prompt || !session || isSending) {
      return;
    }

    setIsSending(true);
    setAiError(null);

    try {
      await aiTutorService.sendMessage({
        sessionId: session.id,
        senderId: student.id,
        senderRole: 'student',
        contentType: 'text',
        content: prompt,
        contentPayload: {
          source: 'student-plan-collaborator',
          planId: plan.id,
          planName: plan.plan.name,
          stepTitle: selectedStep?.title || null,
          stepType: selectedStep?.type || null,
          stepOrder: selectedStep?.order ?? null,
          stepWorkspaceNotes: selectedStep ? (stepWorkspaceNotes[selectedStepIndex] || '') : '',
          noDirectSolutions: true,
          coachingExpectation: 'Guide reasoning, ask questions, and provide hints only.',
        },
        autoReply: true,
      });

      setAiPrompt('');

      const updatedMessages = await aiTutorService.listMessages(session.id);
      setMessages((updatedMessages || []).slice(-40));
    } catch (err: any) {
      setAiError(err?.message || 'Failed to send prompt to collaborator.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <motion.div
      className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-800">{plan.plan.name}</h2>
          </div>
          <p className="text-gray-500 text-sm">{plan.plan.description}</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`${getProgressColor(plan.currentProgress)} h-2.5 rounded-full`}
              style={{ width: `${plan.currentProgress}%` }}
            />
          </div>
        </div>

        <div className="relative pl-6">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" aria-hidden="true" />
          <div className="space-y-6">
            {sortedSteps.map((step, index) => {
              const isCompleted = index < completedStepsCount;
              const isSelected = index === selectedStepIndex;

              return (
                <div key={`${step.title}-${index}`} className="relative flex items-start">
                  <div
                    className={`absolute left-0 top-1 w-5 h-5 rounded-full flex items-center justify-center transform -translate-x-1/2 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    {isCompleted && <CheckCircle className="w-5 h-5 text-white" />}
                  </div>

                  <div
                    className={`w-full p-4 rounded-lg ml-8 transition-colors border ${
                      isSelected
                        ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200'
                        : isCompleted
                          ? 'bg-green-50 border-green-100'
                          : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`font-semibold ${isCompleted ? 'text-green-800' : 'text-gray-700'}`}>{step.title}</h3>
                      <button
                        type="button"
                        onClick={() => setSelectedStepIndex(index)}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Focus step
                      </button>
                    </div>

                    <div className={`flex items-center mt-2 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${getStepTagColor(step.type)}`}>
                      {getStepIcon(step.type)}
                      <span className="ml-1.5 capitalize">{step.type}</span>
                    </div>

                    {step.link && (
                      <a
                        href={step.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open activity content
                      </a>
                    )}

                    {step.additionalResources && step.additionalResources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {step.additionalResources.map((resource, resourceIndex) => (
                          <span key={`${resource}-${resourceIndex}`} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {resource}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="mt-3 text-xs text-gray-500">
                      Use the collaborator to clarify the step, practice, and check your own reasoning before final answers.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStepIndex(index);
                          setAiPrompt(buildStepPrompt(step, 'explain'));
                          setTimeout(() => promptRef.current?.focus(), 0);
                        }}
                        className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700"
                      >
                        Explain concept
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStepIndex(index);
                          setAiPrompt(buildStepPrompt(step, 'practice'));
                          setTimeout(() => promptRef.current?.focus(), 0);
                        }}
                        className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700"
                      >
                        Practice question
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStepIndex(index);
                          setAiPrompt(buildStepPrompt(step, 'reasoning'));
                          setTimeout(() => promptRef.current?.focus(), 0);
                        }}
                        className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700"
                      >
                        Check reasoning
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectedStep && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Step Workspace: {selectedStep.title}</h3>
              <span className="text-[11px] text-slate-500">Draft your thinking before asking the coach</span>
            </div>
            <textarea
              value={stepWorkspaceNotes[selectedStepIndex] || ''}
              onChange={(event) => setStepWorkspaceNotes((prev) => ({ ...prev, [selectedStepIndex]: event.target.value }))}
              placeholder="Write your attempt, assumptions, and questions for this step..."
              className="w-full min-h-[130px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSendPrompt(buildStepPrompt(selectedStep, 'hint'))}
                disabled={isSending || !session}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-60"
              >
                Ask for next hint
              </button>
              <button
                type="button"
                onClick={() => handleSendPrompt(buildStepPrompt(selectedStep, 'reasoning'))}
                disabled={isSending || !session}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-60"
              >
                Review my reasoning
              </button>
              <button
                type="button"
                onClick={() => handleSendPrompt(buildStepPrompt(selectedStep, 'practice'))}
                disabled={isSending || !session}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-60"
              >
                New practice variation
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-4 flex flex-col min-h-[780px]">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="px-4 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  AI Plan Collaborator
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Coaching mode: hints, probing questions, and reflection. No direct full solutions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenTutor?.(`Continue coaching me on ${plan.plan.name}.`)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Full Tutor
              </button>
            </div>
          </div>

          {aiError && (
            <div className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {aiError}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {isAiLoading ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading collaborator...
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-slate-500 text-sm px-4">
                Start with a step prompt. The collaborator will guide your plan progression.
              </div>
            ) : (
              messages.map((message) => {
                const isStudent = message.senderRole === 'student';
                return (
                  <div key={message.id} className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                        isStudent
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700'
                      }`}
                    >
                      {!isStudent && (
                        <div className="mb-1 text-[11px] uppercase tracking-wide font-semibold text-slate-500 inline-flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          Coach
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{message.content || message.transcript || 'Message saved.'}</p>
                      <p className={`text-[10px] mt-1 ${isStudent ? 'text-blue-100' : 'text-slate-400'}`}>
                        {new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}

            {isSending && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-200 p-4 bg-white space-y-3">
            <textarea
              ref={promptRef}
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Ask for guidance on the current step..."
              className="w-full min-h-[90px] rounded-lg border border-slate-200 px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {selectedStep && (
                  <button
                    type="button"
                    onClick={() => setAiPrompt(buildStepPrompt(selectedStep, 'hint'))}
                    className="px-2.5 py-1 rounded-full border border-slate-200 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700"
                  >
                    Hint prompt
                  </button>
                )}
                {selectedStep && (
                  <button
                    type="button"
                    onClick={() => setAiPrompt(buildStepPrompt(selectedStep, 'reasoning'))}
                    className="px-2.5 py-1 rounded-full border border-slate-200 text-xs text-slate-600 hover:border-blue-300 hover:text-blue-700"
                  >
                    Reasoning prompt
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleSendPrompt()}
                disabled={isSending || !aiPrompt.trim() || !session}
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-60"
                aria-label="Send prompt"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </motion.div>
  );
};

export default StudentPlanView;
