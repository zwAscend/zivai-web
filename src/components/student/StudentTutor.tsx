import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Mic, Send, AlertCircle, Brain } from 'lucide-react';
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
  const [messageText, setMessageText] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [selectedStepTitle, setSelectedStepTitle] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);

  const planForSubject = useMemo(() => {
    if (!activePlan || !activePlan.plan?.subjectId) {
      return null;
    }
    return activePlan.plan.subjectId === selectedSubjectId ? activePlan : null;
  }, [activePlan, selectedSubjectId]);

  const planSteps = useMemo(() => {
    return planForSubject?.plan?.steps || [];
  }, [planForSubject]);

  useEffect(() => {
    if (planSteps.length > 0) {
      setSelectedStepTitle((prev) => prev || planSteps[0]?.title || '');
    } else {
      setSelectedStepTitle('');
    }
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!prefillMessage || inputMode !== 'text') {
      return;
    }
    setMessageText((prev) => (prev.trim().length > 0 ? prev : prefillMessage));
    onPrefillApplied?.();
    setTimeout(() => textInputRef.current?.focus(), 0);
  }, [prefillMessage, inputMode, onPrefillApplied]);

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
            <h2 className="text-2xl font-bold text-slate-800">AI Tutor</h2>
            <p className="text-slate-500 mt-1">
              Select a subject from the top-right dropdown to start a tutor session.
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
        <div className="h-6 w-40 bg-blue-100 rounded animate-pulse" />
        {[...Array(6)].map((_, idx) => (
          <div key={idx} className="h-12 bg-blue-50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Tutor Conversation</h3>
              <p className="text-sm text-slate-500">Ask questions, get guided explanations.</p>
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
                Voice
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="font-semibold">Plan focus</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">
                  {planForSubject ? planForSubject.plan.name : 'No active plan for this subject'}
                </span>
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
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const target = selectedStepTitle || 'the next step in my plan';
                  setInputMode('text');
                  setMessageText(`I want to understand ${target}. Please explain it and ask me to recall the key idea.`);
                  setTimeout(() => textInputRef.current?.focus(), 0);
                }}
                className="px-3 py-1.5 text-xs rounded-full bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
                disabled={!planForSubject}
              >
                Explain this step
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = selectedStepTitle || 'this topic';
                  setInputMode('text');
                  setMessageText(`Give me one practice question for ${target}. Let me try before you show the solution.`);
                  setTimeout(() => textInputRef.current?.focus(), 0);
                }}
                className="px-3 py-1.5 text-xs rounded-full bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
                disabled={!planForSubject}
              >
                Practice question
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = selectedStepTitle || 'this step';
                  setInputMode('text');
                  setMessageText(`I attempted ${target}. Ask me to explain my reasoning and check for gaps.`);
                  setTimeout(() => textInputRef.current?.focus(), 0);
                }}
                className="px-3 py-1.5 text-xs rounded-full bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
                disabled={!planForSubject}
              >
                Check my attempt
              </button>
            </div>
            {!planForSubject && (
              <p className="mt-3 text-xs text-slate-500">
                Switch to a subject with an active plan to get step-by-step tutoring.
              </p>
            )}
          </div>
          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-slate-500 py-16">
              <Brain className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>No tutor messages yet. Start the conversation.</p>
            </div>
          ) : (
            messages.map((message) => {
              const isStudent = message.senderRole === 'student';
              return (
                <div
                  key={message.id}
                  className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                      isStudent
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {message.contentType === 'voice' && (
                      <div className="flex items-center gap-2 text-xs mb-1 opacity-80">
                        <Mic className="w-3 h-3" />
                        Voice note
                      </div>
                    )}
                    <p>{message.content || message.transcript || 'Message saved.'}</p>
                    <p className={`text-[11px] mt-1 ${isStudent ? 'text-blue-100' : 'text-slate-400'}`}>
                      {new Date(message.ts).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t p-6">
          {inputMode === 'text' ? (
            <div className="space-y-3">
              <textarea
                rows={3}
                ref={textInputRef}
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder="Type your question for the AI tutor..."
                className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !messageText.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send'}
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Mic className="w-4 h-4 text-blue-600" />
                Paste a voice transcript or summary for now. Voice capture will be enabled soon.
              </div>
              <textarea
                rows={3}
                value={transcriptText}
                onChange={(event) => setTranscriptText(event.target.value)}
                placeholder="Paste voice transcript..."
                className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !transcriptText.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Voice Note'}
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
  );
};

export default StudentTutor;
