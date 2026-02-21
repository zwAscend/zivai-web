import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  assessmentService,
  studentService,
  submissionService,
} from '../../services/api';
import { ApiError } from '../../services/http';
import type { SubmissionReviewDetail, SubmissionReviewQuestionDetail } from '../../services/submissionService';
import type { StudentAssessmentDetail, StudentAssessmentHistoryItem } from '../../services/studentService';
import { toast } from 'sonner';

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

const formatMark = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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

const normalizeStatus = (value?: string | null): AssignmentStatusKey | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'graded' || normalized === 'submitted' || normalized === 'overdue' || normalized === 'pending') {
    return normalized;
  }
  if (normalized === 'reviewed') return 'graded';
  if (normalized === 'assigned') return 'pending';
  return null;
};

const toResultItem = (item: StudentAssessmentHistoryItem): ResultItem | null => {
  const hasResult =
    typeof item.expectedMark === 'number' ||
    typeof item.actualMark === 'number' ||
    typeof item.score === 'number' ||
    !!item.grade ||
    !!item.feedback;

  if (!hasResult) {
    return null;
  }

  return {
    id: item.assignmentId,
    expectedMark: item.expectedMark ?? undefined,
    actualMark: item.actualMark ?? item.score ?? undefined,
    grade: item.grade ?? undefined,
    feedback: item.feedback ?? undefined,
    submittedDate: item.gradedAt || item.submittedAt || undefined,
  };
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
  const [loadingAttemptEntryId, setLoadingAttemptEntryId] = useState<string | null>(null);

  const [reviewSubmissionDetail, setReviewSubmissionDetail] = useState<SubmissionReviewDetail | null>(null);
  const [loadingReviewDetail, setLoadingReviewDetail] = useState(false);
  const reviewDetailCacheRef = useRef<Record<string, SubmissionReviewDetail>>({});
  const [selectedAssessmentDetail, setSelectedAssessmentDetail] = useState<StudentAssessmentDetail | null>(null);
  const [loadingAssessmentDetail, setLoadingAssessmentDetail] = useState(false);
  const assessmentDetailCacheRef = useRef<Record<string, StudentAssessmentDetail>>({});

  const mergeAssessmentIntoEntries = useCallback((assessmentId: string, patch: Partial<AssessmentWithQuestionsItem>) => {
    setEntries((previous) =>
      previous.map((entry) => {
        if (entry.assessmentId !== assessmentId) return entry;
        return {
          ...entry,
          assessment: {
            id: assessmentId,
            ...(entry.assessment || {}),
            ...patch,
          },
        };
      })
    );
  }, []);

  const fetchWorkspace = useCallback(async (options: { forceRefresh?: boolean } = {}) => {
    if (!studentId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const subjectFilter = selectedSubjectId && selectedSubjectId !== 'all' ? selectedSubjectId : undefined;
      const history = await studentService.getAssessmentHistory(
        studentId,
        { subjectId: subjectFilter },
        { forceRefresh: !!options.forceRefresh }
      );

      const mappedEntries: AssignmentEntry[] = history
        .map((item) => {
          const assessment: AssessmentWithQuestionsItem = {
            id: item.assessmentId,
            subjectId: item.subjectId || undefined,
            name: item.assessmentName,
            assessmentType: item.assessmentType || undefined,
            maxScore: item.maxScore ?? undefined,
          };
          const submission: SubmissionSummaryItem | null = item.submissionId
            ? {
                id: item.submissionId,
                assessment: item.assessmentId,
                submittedAt: item.submittedAt || undefined,
                status: item.status || undefined,
              }
            : null;
          const result = toResultItem(item);
          const status =
            normalizeStatus(item.status) || getEntryStatus({ submission, result, dueTime: item.dueTime || null });

          return {
            id: item.enrollmentId,
            assignmentId: item.assignmentId,
            assessmentId: item.assessmentId,
            assessmentName: item.assessmentName,
            dueTime: item.dueTime || null,
            published: item.published,
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
      if (err instanceof ApiError && err.status === 404) {
        setError(null);
      } else {
        setError('Unable to load assessments right now. Please try again.');
      }
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

  const ensureAssessmentWithQuestions = useCallback(
    async (entry: AssignmentEntry): Promise<AssessmentWithQuestionsItem | null> => {
      const existingQuestions = entry.assessment?.questions || [];
      if (existingQuestions.length > 0) {
        return entry.assessment;
      }

      const raw = (await assessmentService.getAssessmentWithQuestions(entry.assessmentId)) as AssessmentWithQuestionsItem;
      const normalizedQuestions = (raw?.questions || []).map((question) => ({
        ...question,
        id: question.id || question.assessmentQuestionId || question.questionId || `${entry.assessmentId}-q`,
      }));
      const mergedAssessment: AssessmentWithQuestionsItem = {
        ...(entry.assessment || {}),
        ...(raw || {}),
        id: entry.assessmentId,
        questions: normalizedQuestions,
      };
      mergeAssessmentIntoEntries(entry.assessmentId, mergedAssessment);
      return mergedAssessment;
    },
    [mergeAssessmentIntoEntries]
  );

  useEffect(() => {
    const assessmentId = selectedReviewEntry?.assessmentId;
    if (!assessmentId || !studentId) {
      setSelectedAssessmentDetail(null);
      setLoadingAssessmentDetail(false);
      return;
    }

    const cacheKey = `${studentId}:${assessmentId}`;
    const cached = assessmentDetailCacheRef.current[cacheKey];
    if (cached) {
      setSelectedAssessmentDetail(cached);
      setLoadingAssessmentDetail(false);
      mergeAssessmentIntoEntries(assessmentId, {
        description: cached.description || undefined,
        maxScore: cached.maxScore ?? undefined,
        assessmentType: cached.assessmentType || undefined,
      });
      return;
    }

    setSelectedAssessmentDetail(null);
    let cancelled = false;

    const fetchAssessmentDetail = async () => {
      setLoadingAssessmentDetail(true);
      try {
        const detail = await studentService.getAssessmentDetail(studentId, assessmentId);
        if (!cancelled) {
          assessmentDetailCacheRef.current[cacheKey] = detail;
          setSelectedAssessmentDetail(detail);
          mergeAssessmentIntoEntries(assessmentId, {
            description: detail.description || undefined,
            maxScore: detail.maxScore ?? undefined,
            assessmentType: detail.assessmentType || undefined,
          });
        }
      } catch {
        if (!cancelled) {
          setSelectedAssessmentDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingAssessmentDetail(false);
        }
      }
    };

    fetchAssessmentDetail();

    return () => {
      cancelled = true;
    };
  }, [studentId, selectedReviewEntry?.assessmentId, mergeAssessmentIntoEntries]);

  const reviewQuestions = useMemo(() => {
    const questions = reviewSubmissionDetail?.questions || [];
    return [...questions].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [reviewSubmissionDetail]);

  useEffect(() => {
    const submissionId = selectedReviewEntry?.submission?.id;
    if (!submissionId) {
      setReviewSubmissionDetail(null);
      setLoadingReviewDetail(false);
      return;
    }

    const cachedDetail = reviewDetailCacheRef.current[submissionId];
    if (cachedDetail) {
      setReviewSubmissionDetail(cachedDetail);
      setLoadingReviewDetail(false);
      return;
    }

    let cancelled = false;

    const fetchReviewSubmissionDetail = async () => {
      setLoadingReviewDetail(true);
      try {
        const detail = await submissionService.getSubmissionReviewDetail(submissionId);
        if (!cancelled) {
          reviewDetailCacheRef.current[submissionId] = detail;
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
  const pendingCount = entries.filter((item) => item.status === 'pending' || item.status === 'overdue').length;
  const reviewedCount = entries.filter((item) => item.status === 'graded').length;
  const reviewedPercent = entries.length > 0 ? Math.round((reviewedCount / entries.length) * 100) : 0;

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
      await fetchWorkspace({ forceRefresh: true });
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
          await fetchWorkspace({ forceRefresh: true });
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
      await fetchWorkspace({ forceRefresh: true });
    } catch (err: any) {
      alert(err?.message || 'Failed to submit assessment.');
    } finally {
      setSubmittingEntryId(null);
    }
  };

  if (loading) {
    return (
      <div className="border border-slate-200 bg-white overflow-hidden animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-[680px]">
          <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4">
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="-mx-4 sm:-mx-5 border-t border-slate-200">
              <div className="h-10 border-b border-slate-200 bg-slate-100" />
              <div className="h-10 border-b border-slate-200 bg-slate-100" />
              <div className="h-10 border-b border-slate-200 bg-slate-100" />
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3.5 space-y-2">
              <div className="h-3 w-20 rounded bg-slate-200" />
              <div className="h-9 rounded-md bg-slate-100" />
              <div className="h-9 rounded-md bg-slate-100" />
              <div className="h-9 rounded-md bg-slate-100" />
              <div className="h-1.5 rounded-full bg-slate-200 mt-2" />
            </div>
          </aside>
          <section className="p-4 sm:p-6 space-y-4">
            <div className="h-16 rounded-lg border border-slate-200 bg-slate-50" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-lg border border-slate-200 bg-white" />
            ))}
            <div className="h-16 rounded-lg border border-slate-200 bg-slate-50" />
            <div className="h-36 rounded-lg border border-slate-200 bg-white" />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 bg-white overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] min-h-[680px]">
        <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold">Assessments</p>
          </div>

          <nav className="-mx-4 sm:-mx-5 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setAssessmentTab('attempt')}
              className={`w-full inline-flex items-center justify-between rounded-none border-b border-slate-200 px-4 sm:px-5 py-2.5 text-sm transition ${
                assessmentTab === 'attempt'
                  ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-2 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              aria-current={assessmentTab === 'attempt' ? 'page' : undefined}
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    assessmentTab === 'attempt'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                </span>
                <span className="truncate">Attempt Assessment</span>
              </span>
              <span className={`text-xs font-semibold ${assessmentTab === 'attempt' ? 'text-blue-700' : 'text-slate-500'}`}>{pendingCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setAssessmentTab('list')}
              className={`w-full inline-flex items-center justify-between rounded-none border-b border-slate-200 px-4 sm:px-5 py-2.5 text-sm transition ${
                assessmentTab === 'list'
                  ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-2 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              aria-current={assessmentTab === 'list' ? 'page' : undefined}
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    assessmentTab === 'list'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                </span>
                <span className="truncate">Assessment List</span>
              </span>
              <span className={`text-xs font-semibold ${assessmentTab === 'list' ? 'text-blue-700' : 'text-slate-500'}`}>{entries.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setAssessmentTab('review')}
              className={`w-full inline-flex items-center justify-between rounded-none border-b border-slate-200 px-4 sm:px-5 py-2.5 text-sm transition ${
                assessmentTab === 'review'
                  ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-2 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              aria-current={assessmentTab === 'review' ? 'page' : undefined}
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    assessmentTab === 'review'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                </span>
                <span className="truncate">Assessment Review</span>
              </span>
              <span className={`text-xs font-semibold ${assessmentTab === 'review' ? 'text-blue-700' : 'text-slate-500'}`}>{reviewedCount}</span>
            </button>
          </nav>

          <div className="rounded-md border border-slate-200 bg-white p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Overview</p>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {reviewedPercent}% reviewed
              </span>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-600">Total assessments</span>
                <span className="text-sm font-semibold text-slate-900">{entries.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <span className="text-sm text-amber-800">Pending action</span>
                <span className="text-sm font-semibold text-amber-800">{pendingCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                <span className="text-sm text-emerald-800">Reviewed</span>
                <span className="text-sm font-semibold text-emerald-800">{reviewedCount}</span>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-1.5 rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${reviewedPercent}%` }} />
              </div>
              <p className="text-[11px] text-slate-500">
                {reviewedCount} of {entries.length} assessments reviewed
              </p>
            </div>
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
                        onClick={async () => {
                          setLoadingAttemptEntryId(entry.id);
                          try {
                            const hydratedAssessment = await ensureAssessmentWithQuestions(entry);
                            const questionCount = hydratedAssessment?.questions?.length || 0;
                            setActiveAttemptEntryId(entry.id);
                            setSubmissionMode(questionCount > 0 ? 'questions' : 'text');
                          } catch {
                            toast.error('Unable to load assessment questions right now.');
                          } finally {
                            setLoadingAttemptEntryId(null);
                          }
                        }}
                        disabled={loadingAttemptEntryId === entry.id}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {loadingAttemptEntryId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {loadingAttemptEntryId === entry.id ? 'Loading...' : 'Start attempt'}
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
                        <p className="mt-1 text-sm text-slate-600">
                          {selectedAssessmentDetail?.description || selectedReviewEntry.assessment?.description || 'Assessment review detail'}
                        </p>
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
                            ? `${selectedReviewEntry.result.actualMark}/${Math.round(Number(selectedAssessmentDetail?.maxScore ?? selectedReviewEntry.assessment?.maxScore ?? 0)) || 'N/A'}`
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
                    {loadingAssessmentDetail && (
                      <p className="mt-3 text-xs text-slate-500">Loading assessment detail...</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
                      <h4 className="text-lg font-semibold text-slate-900">My Attempt</h4>

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
                          ) : reviewQuestions.length > 0 ? (
                            <div className="space-y-3">
                              {reviewQuestions.map((question: SubmissionReviewQuestionDetail, index) => (
                                <article
                                  key={question.assessmentQuestionId || `${question.order || index}-${index}`}
                                  className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2"
                                >
                                  <p className="text-sm font-semibold text-slate-900">Question {question.order || index + 1}</p>
                                  <p className="text-sm text-slate-700">{question.prompt || 'Prompt not available.'}</p>
                                  <div className="rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-700">
                                    {question.studentAnswer ? (
                                      <pre className="whitespace-pre-wrap break-words font-sans">{question.studentAnswer}</pre>
                                    ) : (
                                      <p className="text-slate-500">No answer submitted for this question.</p>
                                    )}
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                              Per-question attempt detail is not available for this submission.
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
                      <h4 className="text-lg font-semibold text-slate-900">Feedback and Marking</h4>

                      {loadingReviewDetail ? (
                        <p className="text-sm text-slate-500">Loading feedback...</p>
                      ) : reviewQuestions.length > 0 ? (
                        <div className="space-y-3">
                          {reviewQuestions.map((question: SubmissionReviewQuestionDetail, index) => (
                            <article
                              key={`${question.assessmentQuestionId || question.order || index}-feedback`}
                              className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-900">Question {question.order || index + 1}</p>
                                <p className="text-xs font-semibold text-slate-600">
                                  {formatMark(question.awardedMarks)} / {formatMark(question.maxMarks)}
                                </p>
                              </div>

                              <div className="rounded-md border border-slate-200 bg-white p-2">
                                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Expected Marking Points</p>
                                {question.expectedMarkingPoints && question.expectedMarkingPoints.length > 0 ? (
                                  <ul className="mt-1 list-disc pl-5 space-y-1 text-sm text-slate-700">
                                    {question.expectedMarkingPoints.map((point, pointIndex) => (
                                      <li key={`${question.assessmentQuestionId || index}-${pointIndex}`}>{point}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-1 text-sm text-slate-500">No expected points were provided.</p>
                                )}
                              </div>

                              <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-sm text-blue-900">
                                <p className="font-semibold">Feedback</p>
                                <p className="mt-1">{question.feedback || 'No per-question feedback yet.'}</p>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">Feedback will appear once this assessment has been graded.</p>
                      )}

                      {!!selectedReviewEntry.result && (
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
                            <p className="font-semibold">Overall Feedback</p>
                            <p className="mt-1">{selectedReviewEntry.result.feedback || 'No feedback provided.'}</p>
                          </div>
                        </>
                      )}

                      {onOpenTutor && selectedReviewEntry.result && (
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
