import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';
import {
  assessmentEnrollmentService,
  assessmentService,
  submissionService,
} from '../../services/api';

interface StudentAssignmentsProps {
  studentId: string;
  selectedSubjectId?: string;
  onOpenTutor?: (prompt?: string) => void;
}

type AssessmentTabKey = 'attempt' | 'list' | 'review';
type StatusFilterKey = 'all' | 'pending' | 'submitted' | 'graded' | 'overdue';
type AssignmentStatusKey = Exclude<StatusFilterKey, 'all'>;
type SubmissionMode = 'questions' | 'text' | 'file';

interface AssessmentQuestionItem {
  id: string;
  assessmentQuestionId?: string;
  questionId?: string;
  stem: string;
  questionTypeCode?: string;
  sequenceIndex?: number;
  points?: number;
  rubricJson?: {
    options?: string[];
  } | null;
}

interface AssessmentWithQuestionsItem {
  id: string;
  subjectId?: string;
  name?: string;
  description?: string;
  assessmentType?: string;
  maxScore?: number;
  weightPct?: number;
  questions?: AssessmentQuestionItem[];
}

interface SubmissionSummaryItem {
  id: string;
  assessment: string;
  submissionType?: string;
  submittedAt?: string;
  status?: string;
  originalFilename?: string;
}

interface ResultItem {
  id: string;
  expectedMark?: number;
  actualMark?: number;
  grade?: string;
  feedback?: string;
  submittedDate?: string;
}

interface AssignmentEntry {
  id: string;
  assignmentId: string;
  assessmentId: string;
  assessmentName: string;
  dueTime: string | null;
  published: boolean;
  assessment: AssessmentWithQuestionsItem | null;
  submission: SubmissionSummaryItem | null;
  result: ResultItem | null;
  status: AssignmentStatusKey;
}

const asDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatAssessmentType = (assessment?: AssessmentWithQuestionsItem | null) => {
  const raw = String(assessment?.assessmentType || 'Assessment').trim();
  if (!raw) return 'Assessment';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getEntryStatus = (entry: {
  submission: SubmissionSummaryItem | null;
  result: ResultItem | null;
  dueTime: string | null;
}): AssignmentStatusKey => {
  if (entry.result && typeof entry.result.actualMark === 'number') return 'graded';
  if (entry.submission) return 'submitted';
  const dueDate = asDate(entry.dueTime);
  if (dueDate && dueDate.getTime() < Date.now()) return 'overdue';
  return 'pending';
};

const getStatusPillClass = (status: AssignmentStatusKey) => {
  switch (status) {
    case 'graded':
      return 'text-emerald-700 bg-emerald-100';
    case 'submitted':
      return 'text-blue-700 bg-blue-100';
    case 'overdue':
      return 'text-rose-700 bg-rose-100';
    default:
      return 'text-amber-700 bg-amber-100';
  }
};

const getStatusLabel = (status: AssignmentStatusKey) => {
  switch (status) {
    case 'graded':
      return 'Graded';
    case 'submitted':
      return 'Submitted';
    case 'overdue':
      return 'Overdue';
    default:
      return 'Pending';
  }
};

const getStatusIcon = (status: AssignmentStatusKey) => {
  switch (status) {
    case 'graded':
      return <CheckCircle className="w-4 h-4" />;
    case 'submitted':
      return <Clock className="w-4 h-4" />;
    case 'overdue':
      return <AlertCircle className="w-4 h-4" />;
    default:
      return <Calendar className="w-4 h-4" />;
  }
};

const resolveAssessmentQuestionId = (question: AssessmentQuestionItem) =>
  question.assessmentQuestionId || question.id;

const StudentAssignments: React.FC<StudentAssignmentsProps> = ({ studentId, selectedSubjectId, onOpenTutor }) => {
  const [entries, setEntries] = useState<AssignmentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assessmentTab, setAssessmentTab] = useState<AssessmentTabKey>('attempt');
  const [selectedReviewEntryId, setSelectedReviewEntryId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterKey>('all');
  const [selectedType, setSelectedType] = useState<'all' | string>('all');

  const [activeAttemptEntryId, setActiveAttemptEntryId] = useState<string | null>(null);
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>('questions');
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [textSubmission, setTextSubmission] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submittingEntryId, setSubmittingEntryId] = useState<string | null>(null);

  const [reviewSubmissionDetail, setReviewSubmissionDetail] = useState<any>(null);
  const [loadingReviewDetail, setLoadingReviewDetail] = useState(false);

  const fetchWorkspace = useCallback(async () => {
    if (!studentId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [enrollmentsRaw, submissionsRaw] = await Promise.all([
        assessmentEnrollmentService.getSummary({ studentId }).catch(() => []),
        submissionService.getStudentSubmissions(studentId).catch(() => []),
      ]);

      const enrollments = enrollmentsRaw || [];
      const submissions = (submissionsRaw || []) as SubmissionSummaryItem[];

      const assessmentIds = Array.from(
        new Set(enrollments.map((item) => item.assessmentId).filter(Boolean))
      );

      const assessmentEntries = await Promise.all(
        assessmentIds.map(async (assessmentId) => {
          try {
            const assessment = await assessmentService.getAssessmentWithQuestions(assessmentId);
            return [assessmentId, assessment as AssessmentWithQuestionsItem] as const;
          } catch {
            return [assessmentId, null] as const;
          }
        })
      );
      const assessmentsById = new Map<string, AssessmentWithQuestionsItem | null>(assessmentEntries);

      const filteredEnrollments =
        selectedSubjectId && selectedSubjectId !== 'all'
          ? enrollments.filter((item) => assessmentsById.get(item.assessmentId)?.subjectId === selectedSubjectId)
          : enrollments;

      const resultEntries = await Promise.all(
        Array.from(new Set(filteredEnrollments.map((item) => item.assessmentId))).map(async (assessmentId) => {
          try {
            const results = (await assessmentService.getResults(assessmentId, studentId)) as ResultItem[];
            return [assessmentId, results?.[0] || null] as const;
          } catch {
            return [assessmentId, null] as const;
          }
        })
      );
      const resultsByAssessmentId = new Map<string, ResultItem | null>(resultEntries);

      const latestSubmissionByAssessmentId = new Map<string, SubmissionSummaryItem>();
      submissions.forEach((submission) => {
        const assessmentId = String(submission.assessment || '').trim();
        if (!assessmentId) return;

        const existing = latestSubmissionByAssessmentId.get(assessmentId);
        if (!existing) {
          latestSubmissionByAssessmentId.set(assessmentId, submission);
          return;
        }

        const existingTime = asDate(existing.submittedAt)?.getTime() || 0;
        const nextTime = asDate(submission.submittedAt)?.getTime() || 0;
        if (nextTime >= existingTime) {
          latestSubmissionByAssessmentId.set(assessmentId, submission);
        }
      });

      const mappedEntries: AssignmentEntry[] = filteredEnrollments
        .map((summary) => {
          const assessment = assessmentsById.get(summary.assessmentId) || null;
          const submission = latestSubmissionByAssessmentId.get(summary.assessmentId) || null;
          const result = resultsByAssessmentId.get(summary.assessmentId) || null;
          const status = getEntryStatus({ submission, result, dueTime: summary.dueTime || null });

          return {
            id: summary.id,
            assignmentId: summary.assignmentId,
            assessmentId: summary.assessmentId,
            assessmentName: summary.assessmentName,
            dueTime: summary.dueTime || null,
            published: summary.published,
            assessment,
            submission,
            result,
            status,
          };
        })
        .sort((a, b) => {
          const aDue = asDate(a.dueTime)?.getTime() || 0;
          const bDue = asDate(b.dueTime)?.getTime() || 0;
          return aDue - bDue;
        });

      setEntries(mappedEntries);
    } catch (err: any) {
      setEntries([]);
      setError(err?.message || 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  }, [studentId, selectedSubjectId]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  useEffect(() => {
    if (entries.length === 0) {
      setSelectedReviewEntryId(null);
      return;
    }

    const selectedStillExists = selectedReviewEntryId
      ? entries.some((entry) => entry.id === selectedReviewEntryId)
      : false;

    if (selectedStillExists) return;

    const defaultEntry = entries.find((entry) => entry.status === 'graded' || entry.status === 'submitted') || entries[0];
    setSelectedReviewEntryId(defaultEntry?.id || null);
  }, [entries, selectedReviewEntryId]);

  const selectedReviewEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedReviewEntryId) || null,
    [entries, selectedReviewEntryId]
  );

  useEffect(() => {
    const submissionId = selectedReviewEntry?.submission?.id;
    if (!submissionId) {
      setReviewSubmissionDetail(null);
      setLoadingReviewDetail(false);
      return;
    }

    let cancelled = false;

    const fetchReviewSubmissionDetail = async () => {
      setLoadingReviewDetail(true);
      try {
        const detail = await submissionService.getSubmissionDetails(submissionId);
        if (!cancelled) {
          setReviewSubmissionDetail(detail);
        }
      } catch {
        if (!cancelled) {
          setReviewSubmissionDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingReviewDetail(false);
        }
      }
    };

    fetchReviewSubmissionDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedReviewEntry?.submission?.id]);

  const assessmentTypes = useMemo(
    () =>
      Array.from(
        new Set(entries.map((entry) => formatAssessmentType(entry.assessment)))
      ).sort(),
    [entries]
  );

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return entries.filter((entry) => {
      const statusMatch = selectedStatus === 'all' || entry.status === selectedStatus;
      const typeMatch = selectedType === 'all' || formatAssessmentType(entry.assessment) === selectedType;
      const queryMatch =
        !query ||
        entry.assessmentName.toLowerCase().includes(query) ||
        String(entry.assessment?.description || '').toLowerCase().includes(query);

      return statusMatch && typeMatch && queryMatch;
    });
  }, [entries, searchQuery, selectedStatus, selectedType]);

  const attemptEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.status === 'pending' || entry.status === 'overdue'),
    [filteredEntries]
  );

  const setAnswerDraft = (assessmentId: string, questionId: string, value: string) => {
    const key = `${assessmentId}:${questionId}`;
    setAnswerDrafts((previous) => ({ ...previous, [key]: value }));
  };

  const getAnswerDraft = (assessmentId: string, questionId: string) => {
    const key = `${assessmentId}:${questionId}`;
    return answerDrafts[key] || '';
  };

  const submitQuestionAnswers = async (entry: AssignmentEntry) => {
    const questions = entry.assessment?.questions || [];
    const answers = questions
      .map((question) => {
        const questionId = resolveAssessmentQuestionId(question);
        return {
          assessmentQuestionId: questionId,
          studentAnswerText: getAnswerDraft(entry.assessmentId, questionId).trim(),
        };
      })
      .filter((answer) => Boolean(answer.studentAnswerText));

    if (answers.length === 0) {
      alert('Please answer at least one question before submitting.');
      return;
    }

    setSubmittingEntryId(entry.id);
    try {
      await submissionService.submitAnswers({
        assessmentId: entry.assessmentId,
        assessmentAssignmentId: entry.assignmentId,
        studentId,
        submissionType: 'manual',
        answers,
      });

      setActiveAttemptEntryId(null);
      await fetchWorkspace();
    } catch (err: any) {
      const message = String(err?.message || 'Failed to submit answers.');
      const needsFallback =
        message.includes('assessmentQuestionId') ||
        message.includes('Question does not belong to this assessment');

      if (!needsFallback) {
        alert(message);
      } else {
        const fallbackText = questions
          .map((question, index) => {
            const questionId = resolveAssessmentQuestionId(question);
            const response = getAnswerDraft(entry.assessmentId, questionId).trim();
            return `Q${index + 1}: ${question.stem}\\nA: ${response || '[No response]'}`;
          })
          .join('\\n\\n');

        try {
          await submissionService.submitAssignment({
            assessmentId: entry.assessmentId,
            studentId,
            submissionType: 'text',
            textContent: fallbackText,
          });
          setActiveAttemptEntryId(null);
          await fetchWorkspace();
        } catch (fallbackError: any) {
          alert(fallbackError?.message || message);
        }
      }
    } finally {
      setSubmittingEntryId(null);
    }
  };

  const submitTextOrFile = async (entry: AssignmentEntry) => {
    if (submissionMode === 'text' && !textSubmission.trim()) {
      alert('Please provide your response text before submitting.');
      return;
    }

    if (submissionMode === 'file' && !selectedFile) {
      alert('Please select a file before submitting.');
      return;
    }

    setSubmittingEntryId(entry.id);
    try {
      await submissionService.submitAssignment({
        assessmentId: entry.assessmentId,
        studentId,
        submissionType: submissionMode === 'file' ? 'file' : 'text',
        textContent: submissionMode === 'text' ? textSubmission.trim() : undefined,
        file: submissionMode === 'file' ? selectedFile || undefined : undefined,
        originalFilename: submissionMode === 'file' ? selectedFile?.name : undefined,
        fileType: submissionMode === 'file' ? selectedFile?.type : undefined,
      });

      setTextSubmission('');
      setSelectedFile(null);
      setActiveAttemptEntryId(null);
      await fetchWorkspace();
    } catch (err: any) {
      alert(err?.message || 'Failed to submit assessment.');
    } finally {
      setSubmittingEntryId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          <div className="h-7 w-40 bg-blue-100 rounded animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-blue-50 rounded-lg p-4 space-y-2">
              <div className="h-5 w-52 bg-blue-100 rounded animate-pulse" />
              <div className="h-4 w-full bg-blue-100 rounded animate-pulse" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-4 bg-blue-100 rounded animate-pulse" />
                <div className="h-4 bg-blue-100 rounded animate-pulse" />
                <div className="h-4 bg-blue-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] min-h-[680px]">
        <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold">Assessments</p>
          <nav className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => setAssessmentTab('attempt')}
              className={`w-full inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                assessmentTab === 'attempt'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>Attempt Assessment</span>
            </button>
            <button
              type="button"
              onClick={() => setAssessmentTab('list')}
              className={`w-full inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                assessmentTab === 'list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Assessment List</span>
            </button>
            <button
              type="button"
              onClick={() => setAssessmentTab('review')}
              className={`w-full inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                assessmentTab === 'review'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Eye className="w-4 h-4 shrink-0" />
              <span>Assessment Review</span>
            </button>
          </nav>

          <div className="mt-5 space-y-2 rounded-md border border-slate-200 bg-white p-3 text-sm">
            <p className="flex items-center justify-between text-slate-600">
              <span>Total</span>
              <span className="font-semibold text-slate-900">{entries.length}</span>
            </p>
            <p className="flex items-center justify-between text-slate-600">
              <span>Pending</span>
              <span className="font-semibold text-slate-900">{entries.filter((item) => item.status === 'pending' || item.status === 'overdue').length}</span>
            </p>
            <p className="flex items-center justify-between text-slate-600">
              <span>Reviewed</span>
              <span className="font-semibold text-slate-900">{entries.filter((item) => item.status === 'graded').length}</span>
            </p>
          </div>
        </aside>

        <section className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {assessmentTab === 'attempt' && (
            <>
              {attemptEntries.map((entry) => {
                const dueDate = asDate(entry.dueTime);
                const questions = entry.assessment?.questions || [];
                const hasQuestions = questions.length > 0;
                const isActive = activeAttemptEntryId === entry.id;

                return (
                  <article key={entry.id} className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{entry.assessmentName}</h3>
                        <p className="mt-1 text-sm text-slate-600">{entry.assessment?.description || 'Open and complete the assessment attempt.'}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${getStatusPillClass(entry.status)}`}>
                        {getStatusIcon(entry.status)}
                        {getStatusLabel(entry.status)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {dueDate ? dueDate.toLocaleDateString() : 'Not set'}</span>
                      </div>
                      <span>Max Score: {Math.round(Number(entry.assessment?.maxScore || 0)) || 'N/A'}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {formatAssessmentType(entry.assessment)}
                      </span>
                    </div>

                    {!isActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAttemptEntryId(entry.id);
                          setSubmissionMode(hasQuestions ? 'questions' : 'text');
                        }}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Start attempt
                      </button>
                    ) : (
                      <div className="border-t border-slate-200 pt-4 space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {hasQuestions && (
                            <button
                              type="button"
                              onClick={() => setSubmissionMode('questions')}
                              className={`px-3 py-1.5 rounded-md text-sm font-medium ${submissionMode === 'questions' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                            >
                              Question responses
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSubmissionMode('text')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium ${submissionMode === 'text' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                          >
                            Text submission
                          </button>
                          <button
                            type="button"
                            onClick={() => setSubmissionMode('file')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium ${submissionMode === 'file' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                          >
                            File upload
                          </button>
                        </div>

                        {submissionMode === 'questions' && hasQuestions && (
                          <div className="space-y-4">
                            {questions
                              .slice()
                              .sort((a, b) => (a.sequenceIndex || 0) - (b.sequenceIndex || 0))
                              .map((question, index) => {
                                const options = Array.isArray(question.rubricJson?.options)
                                  ? question.rubricJson?.options || []
                                  : [];
                                const questionId = resolveAssessmentQuestionId(question);
                                const currentAnswer = getAnswerDraft(entry.assessmentId, questionId);

                                return (
                                  <div key={questionId} className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900">Question {index + 1}</p>
                                      <p className="mt-1 text-sm text-slate-700">{question.stem}</p>
                                    </div>

                                    {options.length > 0 ? (
                                      <div className="space-y-2">
                                        {options.map((option) => (
                                          <label key={`${questionId}-${option}`} className="flex items-center gap-2 text-sm text-slate-700">
                                            <input
                                              type="radio"
                                              name={`question-${questionId}`}
                                              checked={currentAnswer === option}
                                              onChange={() => setAnswerDraft(entry.assessmentId, questionId, option)}
                                              className="h-4 w-4"
                                            />
                                            <span>{option}</span>
                                          </label>
                                        ))}
                                      </div>
                                    ) : (
                                      <textarea
                                        rows={3}
                                        value={currentAnswer}
                                        onChange={(event) => setAnswerDraft(entry.assessmentId, questionId, event.target.value)}
                                        placeholder="Type your answer"
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    )}
                                  </div>
                                );
                              })}

                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => submitQuestionAnswers(entry)}
                                disabled={submittingEntryId === entry.id}
                                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                              >
                                {submittingEntryId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Submit answers
                              </button>
                            </div>
                          </div>
                        )}

                        {submissionMode === 'text' && (
                          <div className="space-y-3">
                            <textarea
                              rows={8}
                              value={textSubmission}
                              onChange={(event) => setTextSubmission(event.target.value)}
                              placeholder="Type your full response"
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => submitTextOrFile(entry)}
                                disabled={submittingEntryId === entry.id || !textSubmission.trim()}
                                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                              >
                                {submittingEntryId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Submit response
                              </button>
                            </div>
                          </div>
                        )}

                        {submissionMode === 'file' && (
                          <div className="space-y-3">
                            <label className="block">
                              <input
                                type="file"
                                className="hidden"
                                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                              />
                              <div className="flex items-center gap-2 rounded-md border-2 border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-blue-400 cursor-pointer">
                                <Upload className="w-4 h-4" />
                                <span>{selectedFile ? selectedFile.name : 'Choose file to upload'}</span>
                              </div>
                            </label>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => submitTextOrFile(entry)}
                                disabled={submittingEntryId === entry.id || !selectedFile}
                                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                              >
                                {submittingEntryId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Submit file
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

              {attemptEntries.length === 0 && (
                <section className="p-4 sm:p-6 space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-lg font-semibold text-slate-800">No pending assessments</p>
                    <p className="text-sm text-slate-500 mt-1">All assessments are already submitted.</p>
                  </div>
                </section>
              )}
            </>
          )}

          {assessmentTab === 'list' && (
            <>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="text-sm text-slate-600">Filters</div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search assessments"
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md"
                    />
                    <select
                      value={selectedType}
                      onChange={(event) => setSelectedType(event.target.value)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md"
                    >
                      <option value="all">All types</option>
                      {assessmentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedStatus}
                      onChange={(event) => setSelectedStatus(event.target.value as StatusFilterKey)}
                      className="px-3 py-2 text-sm border border-slate-200 rounded-md"
                    >
                      <option value="all">All status</option>
                      <option value="pending">Pending</option>
                      <option value="submitted">Submitted</option>
                      <option value="graded">Graded</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {filteredEntries.map((entry) => {
                  const dueDate = asDate(entry.dueTime);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setSelectedReviewEntryId(entry.id);
                        setAssessmentTab('review');
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50/40 transition"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-lg font-semibold text-slate-900 truncate">{entry.assessmentName}</p>
                          <p className="mt-1 text-sm text-slate-600 line-clamp-2">{entry.assessment?.description || 'Assessment available for review.'}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusPillClass(entry.status)}`}>
                          {getStatusIcon(entry.status)}
                          {getStatusLabel(entry.status)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span>Due: {dueDate ? dueDate.toLocaleDateString() : 'Not set'}</span>
                        <span>Max Score: {Math.round(Number(entry.assessment?.maxScore || 0)) || 'N/A'}</span>
                        <span>Weight: {Math.round(Number(entry.assessment?.weightPct || 0)) || 0}%</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {formatAssessmentType(entry.assessment)}
                        </span>
                        {typeof entry.result?.actualMark === 'number' && typeof entry.assessment?.maxScore === 'number' && entry.assessment.maxScore > 0 && (
                          <span className="font-semibold text-emerald-700">
                            Score: {Math.round((entry.result.actualMark / entry.assessment.maxScore) * 100)}%
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredEntries.length === 0 && !loading && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-700">No Assessments</h3>
                  <p className="text-sm text-slate-500">No assessments match the selected filters.</p>
                </div>
              )}
            </>
          )}

          {assessmentTab === 'review' && (
            <>
              {!selectedReviewEntry ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
                  <Eye className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-700">Select an assessment to review</h3>
                  <p className="text-sm text-slate-500">Open Assessment List and pick an assessment.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-2xl font-bold text-slate-900">{selectedReviewEntry.assessmentName}</h3>
                        <p className="mt-1 text-sm text-slate-600">{selectedReviewEntry.assessment?.description || 'Assessment review detail'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAssessmentTab('list')}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Back to list
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs text-slate-500">Outcome</p>
                        <p className="text-base font-semibold text-slate-800">
                          {typeof selectedReviewEntry.result?.actualMark === 'number'
                            ? `${selectedReviewEntry.result.actualMark}/${Math.round(Number(selectedReviewEntry.assessment?.maxScore || 0)) || 'N/A'}`
                            : 'Not graded'}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs text-slate-500">Grade</p>
                        <p className="text-base font-semibold text-slate-800">
                          {selectedReviewEntry.result?.grade || 'Pending'}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs text-slate-500">Status</p>
                        <p className="text-base font-semibold text-slate-800">{getStatusLabel(selectedReviewEntry.status)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
                      <h4 className="text-lg font-semibold text-slate-900">Student Attempt</h4>

                      {!selectedReviewEntry.submission ? (
                        <p className="text-sm text-slate-500">No submission has been made for this assessment yet.</p>
                      ) : (
                        <>
                          <div className="text-sm text-slate-600 space-y-1">
                            <p>Submitted: {asDate(selectedReviewEntry.submission.submittedAt)?.toLocaleString() || 'Unknown'}</p>
                            <p>Type: {selectedReviewEntry.submission.submissionType || 'manual'}</p>
                            {selectedReviewEntry.submission.originalFilename ? (
                              <p>File: {selectedReviewEntry.submission.originalFilename}</p>
                            ) : null}
                          </div>

                          {loadingReviewDetail ? (
                            <p className="text-sm text-slate-500">Loading submission detail...</p>
                          ) : reviewSubmissionDetail?.submissionContent ? (
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                              <p className="font-semibold mb-2">Submitted response</p>
                              <pre className="whitespace-pre-wrap break-words">{String(reviewSubmissionDetail.submissionContent)}</pre>
                            </div>
                          ) : (
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                              Submission content is not available for this attempt.
                            </div>
                          )}
                        </>
                      )}

                      {!!selectedReviewEntry.assessment?.questions?.length && (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-800 mb-2">Assessment Questions</p>
                          <ol className="space-y-2 list-decimal ml-5 text-sm text-slate-700">
                            {selectedReviewEntry.assessment.questions
                              ?.slice()
                              .sort((a, b) => (a.sequenceIndex || 0) - (b.sequenceIndex || 0))
                              .map((question) => (
                                <li key={question.id}>{question.stem}</li>
                              ))}
                          </ol>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
                      <h4 className="text-lg font-semibold text-slate-900">Feedback and Outcome</h4>
                      {!selectedReviewEntry.result ? (
                        <p className="text-sm text-slate-500">Feedback will appear once this assessment has been graded.</p>
                      ) : (
                        <>
                          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
                            <p>
                              Expected mark: <span className="font-semibold">{selectedReviewEntry.result.expectedMark ?? 'N/A'}</span>
                            </p>
                            <p>
                              Actual mark: <span className="font-semibold">{selectedReviewEntry.result.actualMark ?? 'N/A'}</span>
                            </p>
                            <p>
                              Grade: <span className="font-semibold">{selectedReviewEntry.result.grade || 'N/A'}</span>
                            </p>
                          </div>
                          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                            <p className="font-semibold">Feedback</p>
                            <p className="mt-1">{selectedReviewEntry.result.feedback || 'No feedback provided.'}</p>
                          </div>
                          {reviewSubmissionDetail?.autoGrading?.result?.feedback && (
                            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                              <p className="font-semibold">Auto-grading notes</p>
                              <p className="mt-1">{reviewSubmissionDetail.autoGrading.result.feedback}</p>
                            </div>
                          )}
                          {onOpenTutor && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenTutor(
                                  `Review my performance on "${selectedReviewEntry.assessmentName}". Feedback: ${selectedReviewEntry.result?.feedback || 'No feedback provided'}. Help me fix the gaps.`
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                              Review with AI Coach
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default StudentAssignments;
