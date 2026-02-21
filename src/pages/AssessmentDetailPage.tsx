import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Image as ImageIcon, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import Sidebar from '../components/resources/Sidebar';
import {
  API_URL,
  assessmentService,
  fetchData,
  studentService,
  submissionService,
} from '../services/api';
import { Assessment, Student } from '../types';

type DetailTab = 'assessment' | 'submissions' | 'scheme';

interface AssessmentQuestionView {
  id?: string;
  stem: string;
  questionTypeCode?: string;
  points?: number;
  maxMark?: number;
  difficulty?: number;
  rubricJson?: Record<string, unknown> | null;
}

interface AssessmentWithQuestionsView {
  id: string;
  name?: string;
  description?: string;
  assessmentType?: string;
  visibility?: string;
  timeLimitMin?: number;
  attemptsAllowed?: number;
  maxScore?: number;
  weightPct?: number;
  status?: string;
  subjectId?: string;
  resourceId?: string;
  createdAt?: string;
  updatedAt?: string;
  aiEnhanced?: boolean;
  questions?: AssessmentQuestionView[];
}

interface ResourceDetail {
  id: string;
  name?: string;
  mimeType?: string;
  url?: string;
  contentBody?: string;
}

interface SubmissionSummary {
  id: string;
  student: string;
  assessment: string;
  submissionType?: string;
  submittedAt?: string;
  status?: string;
  originalFilename?: string;
}

interface SubmissionDetail {
  id: string;
  submissionType?: string;
  submissionContent?: string;
  externalAssessmentData?: Record<string, unknown> | null;
  autoGrading?: {
    result?: {
      feedback?: string;
      breakdown?: unknown;
      grade?: string;
      percentage?: number;
      totalScore?: number;
    };
  };
}

interface ResultStudentRef {
  id?: string;
  firstName?: string;
  lastName?: string;
}

interface ResultCriteria {
  criterion?: string;
  comments?: string;
  score?: number;
}

interface ResultRecord {
  id: string;
  student: string | ResultStudentRef;
  assessment: string;
  expectedMark?: number;
  actualMark?: number;
  grade?: string;
  feedback?: string;
  submittedDate?: Date | string;
  externalAssessmentData?: {
    fileName?: string;
    criteria?: ResultCriteria[];
    [key: string]: unknown;
  } | null;
}

const formatDate = (value?: string | Date | null) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
};

const parseQuestions = (assessment: AssessmentWithQuestionsView | Assessment | null): AssessmentQuestionView[] => {
  if (!assessment) return [];
  const raw = (assessment as any).questions;

  if (Array.isArray(raw)) {
    return raw.map((item: any, index: number) => ({
      id: item.id || item.questionId || `q-${index}`,
      stem: item.stem || item.text || `Question ${index + 1}`,
      questionTypeCode: item.questionTypeCode || item.type,
      points: item.points,
      maxMark: item.maxMark,
      difficulty: item.difficulty,
      rubricJson: (item.rubricJson || item.metadata || null) as Record<string, unknown> | null,
    }));
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any, index: number) => ({
          id: item.id || `q-${index}`,
          stem: item.stem || item.text || `Question ${index + 1}`,
          questionTypeCode: item.questionTypeCode || item.type,
          points: item.points,
          maxMark: item.maxMark,
          difficulty: item.difficulty,
          rubricJson: (item.rubricJson || item.metadata || null) as Record<string, unknown> | null,
        }));
      }
    } catch (_error) {
      return [];
    }
  }

  return [];
};

const resolveStudentId = (student: ResultRecord['student']) => {
  if (!student) return '';
  if (typeof student === 'string') return student;
  return student.id || '';
};

const resolveResourceUrl = (url?: string) => {
  if (!url || url.startsWith('content://')) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (!url.startsWith('/')) return url;
  if (API_URL.startsWith('http://') || API_URL.startsWith('https://')) {
    const withoutApiSuffix = API_URL.replace(/\/api\/?$/, '');
    return `${withoutApiSuffix}${url}`;
  }
  return url;
};

const scoreDisplay = (actualMark?: number, expectedMark?: number) => {
  if (actualMark == null && expectedMark == null) return 'N/A';
  if (actualMark == null) return `-/ ${expectedMark ?? 0}`;
  return `${actualMark} / ${expectedMark ?? 0}`;
};

const AssessmentDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [activeTab, setActiveTab] = useState<DetailTab>('assessment');
  const [assessment, setAssessment] = useState<AssessmentWithQuestionsView | Assessment | null>(null);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [studentsById, setStudentsById] = useState<Record<string, Student>>({});
  const [resource, setResource] = useState<ResourceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedResultId, setSelectedResultId] = useState('');
  const [submissionDetail, setSubmissionDetail] = useState<SubmissionDetail | null>(null);
  const [submissionLoading, setSubmissionLoading] = useState(false);

  const [editableActualMark, setEditableActualMark] = useState<number>(0);
  const [editableGrade, setEditableGrade] = useState('');
  const [editableFeedback, setEditableFeedback] = useState('');
  const [savingResult, setSavingResult] = useState(false);

  const questions = useMemo(() => parseQuestions(assessment), [assessment]);

  const selectedResult = useMemo(() => {
    if (results.length === 0) return null;
    return results.find((item) => item.id === selectedResultId) || results[0];
  }, [results, selectedResultId]);

  const selectedStudentName = useMemo(() => {
    if (!selectedResult) return '';
    const studentId = resolveStudentId(selectedResult.student);
    if (studentId && studentsById[studentId]) {
      const student = studentsById[studentId];
      return `${student.firstName} ${student.lastName}`;
    }
    if (typeof selectedResult.student === 'object') {
      const firstName = selectedResult.student.firstName || '';
      const lastName = selectedResult.student.lastName || '';
      return `${firstName} ${lastName}`.trim();
    }
    return studentId || 'Unknown Student';
  }, [selectedResult, studentsById]);

  useEffect(() => {
    const loadAssessmentDetails = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const detailedAssessment = await assessmentService.getAssessmentWithQuestions(id)
          .catch(() => assessmentService.getAssessment(id));

        const normalizedAssessment = detailedAssessment as AssessmentWithQuestionsView | Assessment;
        setAssessment(normalizedAssessment);

        const subjectId = (normalizedAssessment as any).subjectId;
        const resourceId = (normalizedAssessment as any).resourceId || (normalizedAssessment as any).resource;

        const [resultList, studentList] = await Promise.all([
          assessmentService.getResults(id).catch(() => []),
          subjectId ? studentService.getStudents(subjectId).catch(() => []) : Promise.resolve([]),
        ]);

        const normalizedResults = (resultList || []) as ResultRecord[];
        setResults(normalizedResults);
        setSelectedResultId(normalizedResults[0]?.id || '');

        const nextStudentsById: Record<string, Student> = {};
        (studentList || []).forEach((student) => {
          nextStudentsById[student.id] = student;
        });
        setStudentsById(nextStudentsById);

        if (resourceId && typeof resourceId === 'string') {
          const linkedResource = await fetchData<ResourceDetail>(`/resources/${resourceId}`).catch(() => null);
          setResource(linkedResource);
        } else {
          setResource(null);
        }
      } catch (error) {
        console.error('Failed to load assessment details:', error);
        setAssessment(null);
        setResults([]);
        setResource(null);
      } finally {
        setLoading(false);
      }
    };

    loadAssessmentDetails();
  }, [id]);

  useEffect(() => {
    if (!selectedResult) {
      setEditableActualMark(0);
      setEditableGrade('');
      setEditableFeedback('');
      return;
    }

    setEditableActualMark(selectedResult.actualMark ?? 0);
    setEditableGrade(selectedResult.grade || '');
    setEditableFeedback(selectedResult.feedback || '');
  }, [selectedResult]);

  useEffect(() => {
    const loadSubmissionForSelectedStudent = async () => {
      if (!selectedResult || !id) {
        setSubmissionDetail(null);
        return;
      }

      const studentId = resolveStudentId(selectedResult.student);
      if (!studentId) {
        setSubmissionDetail(null);
        return;
      }

      setSubmissionLoading(true);
      try {
        const summaries = await submissionService.getStudentSubmissions(studentId) as SubmissionSummary[];
        const latestForAssessment = (summaries || [])
          .filter((summary) => summary.assessment === id)
          .sort((left, right) => {
            const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
            const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
            return rightTime - leftTime;
          })[0];

        if (!latestForAssessment) {
          setSubmissionDetail(null);
          return;
        }

        const detail = await submissionService.getSubmissionDetails(latestForAssessment.id) as SubmissionDetail;
        setSubmissionDetail(detail || null);
      } catch (error) {
        console.error('Failed to load submission detail:', error);
        setSubmissionDetail(null);
      } finally {
        setSubmissionLoading(false);
      }
    };

    loadSubmissionForSelectedStudent();
  }, [selectedResult, id]);

  const saveEditedResult = async () => {
    if (!id || !selectedResult) return;

    setSavingResult(true);
    try {
      const updated = await assessmentService.updateResult(id, selectedResult.id, {
        actualMark: editableActualMark,
        grade: editableGrade,
        feedback: editableFeedback,
      });

      setResults((previous) => previous.map((item) => (
        item.id === selectedResult.id
          ? { ...item, ...updated, student: item.student }
          : item
      )));

      toast.success('Feedback updated successfully.');
    } catch (error) {
      console.error('Failed to update result:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update feedback.');
    } finally {
      setSavingResult(false);
    }
  };

  const assessmentName = (assessment as any)?.name || 'Assessment';
  const assessmentType = (assessment as any)?.assessmentType || (assessment as any)?.type || 'Assessment';
  const assessmentStatus = (assessment as any)?.status || 'draft';
  const assessmentVisibility = (assessment as any)?.visibility || 'private';
  const assessmentMaxScore = (assessment as any)?.maxScore ?? 0;
  const attemptsAllowed = (assessment as any)?.attemptsAllowed ?? 1;
  const weightPct = (assessment as any)?.weightPct ?? (assessment as any)?.weight ?? 0;
  const linkedResourceUrl = resolveResourceUrl(resource?.url);
  const linkedResourceMime = (resource?.mimeType || '').toLowerCase();

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="assessments"
        onViewAssessments={() => navigate('/assessments/view')}
        onCreateAssessment={() => navigate('/assessments/create')}
        onMarkAssessment={() => navigate('/assessments/mark')}
        onAssessmentAnalysis={() => navigate(`/assessments/analysis${id ? `?assessmentId=${id}` : ''}`)}
        onStudentAnalysis={() => navigate('/assessments/student-analysis')}
        activeAction="view-assessments"
        recentUploads={[]}
      />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{assessmentName}</h1>
              <p className="text-sm text-slate-500">View assessment content, student attempts, and editable feedback.</p>
            </div>
            <button
              onClick={() => navigate('/assessments/view')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Back to Assessments
            </button>
          </div>

          <div className="mb-4 grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1">Type: {assessmentType}</div>
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1">Status: {assessmentStatus}</div>
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1">Visibility: {assessmentVisibility}</div>
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1">Max score: {assessmentMaxScore}</div>
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1">Weight: {weightPct}%</div>
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1">Attempts: {attemptsAllowed}</div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('assessment')}
              className={`px-3 py-2 text-sm ${activeTab === 'assessment' ? 'border-b-2 border-blue-600 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Assessment View
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-3 py-2 text-sm ${activeTab === 'submissions' ? 'border-b-2 border-blue-600 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Student Submissions
            </button>
            <button
              onClick={() => setActiveTab('scheme')}
              className={`px-3 py-2 text-sm ${activeTab === 'scheme' ? 'border-b-2 border-blue-600 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-800'}`}
            >
              Marking Scheme
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-20 bg-slate-200 rounded animate-pulse" />
              ))}
            </div>
          ) : !assessment ? (
            <div className="text-sm text-slate-500">Assessment not found.</div>
          ) : (
            <>
              {activeTab === 'assessment' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
                    <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Assessment Content</h2>

                    {(assessment as any)?.description && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                        {(assessment as any).description}
                      </div>
                    )}

                    {resource ? (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-600">Linked Resource: {resource.name || 'Resource'}</div>

                        {linkedResourceMime.startsWith('image/') && linkedResourceUrl && (
                          <img src={linkedResourceUrl} alt={resource.name || 'Assessment resource'} className="max-h-[420px] w-full object-contain rounded-md border border-slate-200 bg-slate-50" />
                        )}

                        {linkedResourceMime.includes('pdf') && linkedResourceUrl && (
                          <iframe src={linkedResourceUrl} title="Assessment PDF" className="w-full h-[420px] rounded-md border border-slate-200 bg-white" />
                        )}

                        {!linkedResourceMime.startsWith('image/') && !linkedResourceMime.includes('pdf') && resource.contentBody && (
                          <pre className="max-h-[420px] overflow-auto text-xs rounded-md border border-slate-200 bg-slate-50 p-3 whitespace-pre-wrap">
                            {resource.contentBody}
                          </pre>
                        )}

                        {!resource.contentBody && linkedResourceUrl && !linkedResourceMime.startsWith('image/') && !linkedResourceMime.includes('pdf') && (
                          <a
                            href={linkedResourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                          >
                            <FileText className="w-4 h-4" />
                            Open linked assessment file
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">No linked resource file found. Showing question canvas below.</div>
                    )}

                    {questions.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-600">Question Canvas</div>
                        <div className="max-h-[320px] overflow-y-auto border border-slate-200 rounded-md divide-y divide-slate-100">
                          {questions.map((question, index) => (
                            <div key={question.id || `question-${index}`} className="p-3 text-sm">
                              <div className="font-semibold text-slate-800">Q{index + 1}. {question.stem}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                Type: {question.questionTypeCode || 'N/A'} • Marks: {question.points ?? question.maxMark ?? 0}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Student Attempt + Feedback</h2>
                      {results.length > 0 && (
                        <select
                          value={selectedResult?.id || ''}
                          onChange={(event) => setSelectedResultId(event.target.value)}
                          className="border border-slate-200 rounded-md px-2 py-1 text-xs"
                        >
                          {results.map((item) => {
                            const studentId = resolveStudentId(item.student);
                            const student = studentsById[studentId];
                            const label = student
                              ? `${student.firstName} ${student.lastName}`
                              : (typeof item.student === 'object'
                                ? `${item.student.firstName || ''} ${item.student.lastName || ''}`.trim() || studentId
                                : studentId);
                            return (
                              <option key={item.id} value={item.id}>{label || 'Unknown Student'}</option>
                            );
                          })}
                        </select>
                      )}
                    </div>

                    {!selectedResult ? (
                      <div className="text-sm text-slate-500">No marked student results yet for this assessment.</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm space-y-1">
                          <div className="font-semibold text-slate-800">{selectedStudentName || 'Student attempt'}</div>
                          <div className="text-xs text-slate-600">Submitted: {formatDate(selectedResult.submittedDate as any)}</div>
                          <div className="text-xs text-slate-600">Score: {scoreDisplay(selectedResult.actualMark, selectedResult.expectedMark)}</div>
                        </div>

                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <div className="text-xs font-semibold text-slate-600 mb-2">Student Submission</div>
                          {submissionLoading ? (
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Loading submission...
                            </div>
                          ) : submissionDetail ? (
                            <div className="space-y-2 text-sm">
                              <div className="text-xs text-slate-500">Type: {submissionDetail.submissionType || 'N/A'}</div>
                              {submissionDetail.submissionContent ? (
                                <div className="text-sm text-slate-700 whitespace-pre-wrap rounded-md bg-slate-50 border border-slate-200 p-2">
                                  {submissionDetail.submissionContent}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500">No submission text/file payload returned for this attempt.</div>
                              )}
                              {Boolean(submissionDetail.externalAssessmentData) && (
                                <details className="text-xs text-slate-600">
                                  <summary className="cursor-pointer">External assessment payload</summary>
                                  <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 whitespace-pre-wrap">
                                    {JSON.stringify(submissionDetail.externalAssessmentData, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">No submission record found for this student/assessment pair.</div>
                          )}
                        </div>

                        <div className="rounded-md border border-slate-200 bg-white p-3 space-y-3">
                          <div className="text-xs font-semibold text-slate-600">Edit Grade + Feedback</div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-slate-500">Actual Mark</label>
                              <input
                                type="number"
                                value={Number.isFinite(editableActualMark) ? editableActualMark : 0}
                                onChange={(event) => setEditableActualMark(Number(event.target.value) || 0)}
                                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Grade</label>
                              <input
                                value={editableGrade}
                                onChange={(event) => setEditableGrade(event.target.value)}
                                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                                placeholder="e.g. A"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs text-slate-500">Teacher Feedback</label>
                            <textarea
                              value={editableFeedback}
                              onChange={(event) => setEditableFeedback(event.target.value)}
                              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm min-h-[120px]"
                            />
                          </div>

                          {selectedResult.externalAssessmentData?.criteria && selectedResult.externalAssessmentData.criteria.length > 0 && (
                            <details className="text-xs text-slate-600">
                              <summary className="cursor-pointer">Criteria breakdown from AI marking</summary>
                              <div className="mt-2 space-y-2">
                                {selectedResult.externalAssessmentData.criteria.map((criterion: ResultCriteria, index: number) => (
                                  <div key={`${criterion.criterion || 'criterion'}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                    <div className="font-semibold text-slate-700">{criterion.criterion || `Criterion ${index + 1}`}</div>
                                    {criterion.score != null && (
                                      <div className="text-slate-500">Score: {criterion.score}</div>
                                    )}
                                    {criterion.comments && (
                                      <div className="text-slate-600">{criterion.comments}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={saveEditedResult}
                              disabled={savingResult}
                              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                              {savingResult ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              Save Feedback
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {activeTab === 'submissions' && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-700">
                    Student Assessment Attempts ({results.length})
                  </div>
                  {results.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500">No marked attempts are available yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                          <tr>
                            <th className="text-left px-4 py-3">Student</th>
                            <th className="text-left px-4 py-3">Submitted</th>
                            <th className="text-left px-4 py-3">Score</th>
                            <th className="text-left px-4 py-3">Grade</th>
                            <th className="text-left px-4 py-3">Feedback</th>
                            <th className="text-right px-4 py-3">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((item) => {
                            const studentId = resolveStudentId(item.student);
                            const student = studentsById[studentId];
                            const studentName = student
                              ? `${student.firstName} ${student.lastName}`
                              : (typeof item.student === 'object'
                                ? `${item.student.firstName || ''} ${item.student.lastName || ''}`.trim() || studentId
                                : studentId);

                            return (
                              <tr key={item.id} className="border-t border-slate-100">
                                <td className="px-4 py-3 text-slate-800">{studentName || 'Unknown Student'}</td>
                                <td className="px-4 py-3 text-slate-600">{formatDate(item.submittedDate as any)}</td>
                                <td className="px-4 py-3 text-slate-600">{scoreDisplay(item.actualMark, item.expectedMark)}</td>
                                <td className="px-4 py-3 text-slate-600">{item.grade || 'N/A'}</td>
                                <td className="px-4 py-3 text-slate-600 max-w-[360px] truncate">{item.feedback || '-'}</td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => {
                                      setSelectedResultId(item.id);
                                      setActiveTab('assessment');
                                    }}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    Open
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'scheme' && (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">Teacher Marking Reference</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-slate-600">
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2">Created: {formatDate((assessment as any).createdAt)}</div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2">Updated: {formatDate((assessment as any).updatedAt)}</div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2">AI enhanced: {(assessment as any).aiEnhanced || (assessment as any).isAIEnhanced ? 'Yes' : 'No'}</div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2">Questions: {questions.length}</div>
                    </div>
                  </div>

                  {questions.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-500">No question-level marking scheme found.</div>
                  ) : (
                    <div className="space-y-3">
                      {questions.map((question, index) => {
                        const rubric = question.rubricJson || null;
                        const imageUrl = rubric && typeof rubric === 'object' && typeof (rubric as any).imageUrl === 'string'
                          ? (rubric as any).imageUrl
                          : null;

                        return (
                          <div key={question.id || `scheme-${index}`} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">Q{index + 1}. {question.stem}</div>
                                <div className="text-xs text-slate-500 mt-1">Type: {question.questionTypeCode || 'N/A'} • Marks: {question.points ?? question.maxMark ?? 0}</div>
                              </div>
                              <div className="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-600">
                                Difficulty: {question.difficulty ?? 'N/A'}
                              </div>
                            </div>

                            {imageUrl && (
                              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                                <div className="text-xs font-semibold text-slate-600 mb-2 inline-flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3" />
                                  Question Diagram
                                </div>
                                <img src={imageUrl} alt={`Question ${index + 1} diagram`} className="max-h-64 object-contain rounded-md bg-white border border-slate-200" />
                              </div>
                            )}

                            {rubric ? (
                              <details className="text-xs text-slate-600">
                                <summary className="cursor-pointer font-semibold">Rubric / Marking Scheme JSON</summary>
                                <pre className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 max-h-64 overflow-auto whitespace-pre-wrap">
                                  {JSON.stringify(rubric, null, 2)}
                                </pre>
                              </details>
                            ) : (
                              <div className="text-xs text-slate-500">No rubric metadata attached for this question.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AssessmentDetailPage;
