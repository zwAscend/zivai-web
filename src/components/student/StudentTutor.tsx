import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, BookOpen, Brain, Loader2, Mic, Send, Sparkles } from 'lucide-react';
import { DevelopmentPlan, Subject } from '../../types';
import { aiTutorService, AiTutorMessage, AiTutorSession } from '../../services/aiTutorService';

type StudentTutorProps = {
  studentId: string;
  selectedSubjectId: string;
  subjects: Subject[];
  activePlan?: DevelopmentPlan | null;
  prefillMessage?: string;
  onPrefillApplied?: () => void;
};

type CoachMode = 'socratic' | 'hint';

type WorkspaceCheckpoint = {
  id: string;
  note: string;
  createdAt: string;
};

const StudentTutor: React.FC<StudentTutorProps> = ({
  studentId,
  selectedSubjectId,
  subjects,
  activePlan,
  prefillMessage,
  onPrefillApplied,
}) => {
  const [session, setSession] = useState<AiTutorSession | null>(null);
  const [messages, setMessages] = useState<AiTutorMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [coachMode, setCoachMode] = useState<CoachMode>('socratic');
  const [messageText, setMessageText] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [selectedStepTitle, setSelectedStepTitle] = useState<string>('');
  const [taskGoal, setTaskGoal] = useState('');
  const [reasoningCanvas, setReasoningCanvas] = useState('');
  const [workspaceCheckpoints, setWorkspaceCheckpoints] = useState<WorkspaceCheckpoint[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);

  const planForSubject = useMemo(() => {
    if (!activePlan || !activePlan.plan?.subjectId) {
      return null;
    }
    return activePlan.plan.subjectId === selectedSubjectId ? activePlan : null;
  }, [activePlan, selectedSubjectId]);

  const planSteps = useMemo(() => (
    planForSubject?.plan?.steps || []
  ), [planForSubject]);

  useEffect(() => {
    if (planSteps.length > 0) {
      setSelectedStepTitle((prev) => prev || planSteps[0]?.title || '');
      return;
    }
    setSelectedStepTitle('');
  }, [planSteps]);

  useEffect(() => {
    if (!studentId || selectedSubjectId === 'all') {
      setSession(null);
      setMessages([]);
      return;
    }

    let isActive = true;
    setLoading(true);
    setError(null);

    (async () => {
      const nextSession = await aiTutorService.getOrCreateSession(
        studentId,
        selectedSubjectId,
        studentId
      );
      if (!isActive) {
        return;
      }
      setSession(nextSession);
      const chatMessages = await aiTutorService.listMessages(nextSession.id);
      if (!isActive) {
        return;
      }
      setMessages(chatMessages);
    })()
      .catch((err: any) => {
        if (!isActive) {
          return;
        }
        setError(err?.message || 'Failed to load AI tutor session.');
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [studentId, selectedSubjectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  useEffect(() => {
    if (!prefillMessage || inputMode !== 'text') {
      return;
    }
    setTaskGoal((prev) => (prev.trim().length > 0 ? prev : prefillMessage));
    setMessageText((prev) => (prev.trim().length > 0 ? prev : prefillMessage));
    onPrefillApplied?.();
    setTimeout(() => textInputRef.current?.focus(), 0);
  }, [prefillMessage, inputMode, onPrefillApplied]);

  const buildGuidedPrompt = (baseRequest: string) => {
    const focus = selectedStepTitle || taskGoal.trim() || 'this topic';
    if (baseRequest === 'hint') {
      return `Give me one hint for ${focus}. Ask a guiding question and do not give the full solution.`;
    }
    if (baseRequest === 'challenge') {
      return `Challenge my reasoning on ${focus}. Point out possible gaps and ask me to defend each step.`;
    }
    return `Give me one practice question on ${focus}. Let me attempt first, then guide with hints only.`;
  };

  const applyGuidedPrompt = (kind: 'hint' | 'challenge' | 'practice') => {
    setInputMode('text');
    setMessageText(buildGuidedPrompt(kind));
    setTimeout(() => textInputRef.current?.focus(), 0);
  };

  const saveCheckpoint = () => {
    const note = reasoningCanvas.trim();
    if (!note) {
      return;
    }
    const snapshot = note.split('\n').slice(0, 3).join(' ').trim();
    if (!snapshot) {
      return;
    }
    const checkpoint: WorkspaceCheckpoint = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      note: snapshot.length > 180 ? `${snapshot.slice(0, 177)}...` : snapshot,
      createdAt: new Date().toISOString(),
    };
    setWorkspaceCheckpoints((prev) => [checkpoint, ...prev].slice(0, 8));
  };

  const handleSend = async () => {
    if (!session || sending) {
      return;
    }

    const trimmedText = messageText.trim();
    const trimmedTranscript = transcriptText.trim();
    const hasContent = inputMode === 'text' ? trimmedText : trimmedTranscript;

    if (!hasContent) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      await aiTutorService.sendMessage({
        sessionId: session.id,
        senderId: studentId,
        senderRole: 'student',
        contentType: inputMode === 'voice' ? 'voice' : 'text',
        content: inputMode === 'text' ? trimmedText : undefined,
        transcript: inputMode === 'voice' ? trimmedTranscript : undefined,
        contentPayload: {
          coachingMode: coachMode,
          noDirectSolutions: true,
          expectation: 'Guide with probing questions, hints, and reflective prompts.',
          taskGoal: taskGoal.trim() || null,
          selectedPlanStep: selectedStepTitle || null,
          reasoningCanvas: reasoningCanvas.trim() || null,
        },
        autoReply: true,
      });

      setMessageText('');
      setTranscriptText('');

      const chatMessages = await aiTutorService.listMessages(session.id);
      setMessages(chatMessages);
    } catch (err: any) {
      setError(err?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  if (selectedSubjectId === 'all') {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <Brain className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">AI Study Coach</h2>
            <p className="text-slate-500 mt-1">
              Select a subject to open your guided coaching workspace.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
              {subjects.map((subject) => (
                <span key={subject.id} className="px-2.5 py-1 rounded-full bg-slate-100">
                  {subject.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div className="h-6 w-56 bg-blue-100 rounded animate-pulse" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[...Array(2)].map((_, idx) => (
            <div key={idx} className="h-96 bg-blue-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.25fr] gap-6 min-h-[680px]">
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4 min-h-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Learning Workspace</h3>
            <p className="text-sm text-slate-500">Define your goal, think aloud, and let AI coach your reasoning.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BookOpen className="w-4 h-4 text-blue-600" />
                Plan focus
              </div>
              {planSteps.length > 0 && (
                <select
                  value={selectedStepTitle}
                  onChange={(event) => setSelectedStepTitle(event.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
                >
                  {planSteps.map((step) => (
                    <option key={step.title} value={step.title}>
                      {step.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {planForSubject
                ? planForSubject.plan.name
                : 'No active subject plan. Set a task goal manually to continue.'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-500">Task Goal</label>
            <textarea
              value={taskGoal}
              onChange={(event) => setTaskGoal(event.target.value)}
              placeholder="e.g. I need to understand simultaneous equations using substitution."
              className="w-full min-h-[88px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-500">Reasoning Canvas</label>
              <button
                type="button"
                onClick={saveCheckpoint}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Save checkpoint
              </button>
            </div>
            <textarea
              value={reasoningCanvas}
              onChange={(event) => setReasoningCanvas(event.target.value)}
              placeholder="Write your attempt, assumptions, or partial steps here."
              className="w-full flex-1 min-h-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-500">Coaching shortcuts</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyGuidedPrompt('hint')}
                className="px-2.5 py-1.5 text-xs rounded-full border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
              >
                Ask for next hint
              </button>
              <button
                type="button"
                onClick={() => applyGuidedPrompt('challenge')}
                className="px-2.5 py-1.5 text-xs rounded-full border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
              >
                Challenge my reasoning
              </button>
              <button
                type="button"
                onClick={() => applyGuidedPrompt('practice')}
                className="px-2.5 py-1.5 text-xs rounded-full border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
              >
                Give a practice question
              </button>
            </div>
          </div>

          {workspaceCheckpoints.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-600">Recent checkpoints</div>
              {workspaceCheckpoints.map((checkpoint) => (
                <div key={checkpoint.id} className="text-xs text-slate-600 border-l-2 border-slate-200 pl-2">
                  <div>{checkpoint.note}</div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {new Date(checkpoint.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col min-h-0">
          <div className="p-5 border-b border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">AI Coach Dialog</h3>
                <p className="text-sm text-slate-500">The tutor guides your thinking; it should not hand over full solutions.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCoachMode('socratic')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${
                    coachMode === 'socratic'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  Socratic
                </button>
                <button
                  type="button"
                  onClick={() => setCoachMode('hint')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${
                    coachMode === 'hint'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  Hint-first
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${
                  inputMode === 'text'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => setInputMode('voice')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${
                  inputMode === 'voice'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                Voice transcript
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 bg-slate-50">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-slate-500 py-16">
                <div>
                  <Brain className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p>No messages yet. Start by describing your approach in the workspace.</p>
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isStudent = message.senderRole === 'student';
                const isSystem = message.senderRole === 'system';
                return (
                  <div
                    key={message.id}
                    className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm ${
                        isStudent
                          ? 'bg-blue-600 text-white'
                          : isSystem
                            ? 'bg-amber-50 border border-amber-200 text-amber-800'
                            : 'bg-white border border-slate-200 text-slate-700'
                      }`}
                    >
                      {!isStudent && !isSystem && (
                        <div className="mb-1 text-[11px] uppercase tracking-wide font-semibold text-slate-500 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Tutor guidance
                        </div>
                      )}
                      {message.contentType === 'voice' && (
                        <div className="flex items-center gap-2 text-xs mb-1 opacity-80">
                          <Mic className="w-3 h-3" />
                          Voice note
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{message.content || message.transcript || 'Message saved.'}</p>
                      <p className={`text-[11px] mt-1 ${isStudent ? 'text-blue-100' : 'text-slate-400'}`}>
                        {new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-200 p-5 space-y-3 bg-white">
            {inputMode === 'voice' && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Mic className="w-4 h-4 text-blue-600" />
                Paste voice transcript for now. The coach will still respond with guided prompts.
              </div>
            )}
            <div className="relative">
              {inputMode === 'text' ? (
                <textarea
                  rows={3}
                  ref={textInputRef}
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Ask the coach for the next step, hint, or reasoning check..."
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <textarea
                  rows={3}
                  value={transcriptText}
                  onChange={(event) => setTranscriptText(event.target.value)}
                  placeholder="Paste voice transcript..."
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || (inputMode === 'text' ? !messageText.trim() : !transcriptText.trim())}
                className="absolute right-2 bottom-2 inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-60"
                aria-label="Send coaching prompt"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Coaching rule: the AI should ask guiding questions, hints, and reflection prompts instead of giving final solved answers.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StudentTutor;
