import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/resources/Sidebar';
import { assessmentService, studentService, subjectService } from '../services/api';
import { Assessment, Student, Subject } from '../types';

interface StudentAssessmentRow {
  assessment: Assessment;
  attempts: {
    actualMark: number;
    expectedMark: number;
    grade?: string;
    submittedDate?: string;
  }[];
}

const StudentAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assessmentQuery, setAssessmentQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StudentAssessmentRow[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [presetSubjectId, setPresetSubjectId] = useState('');
  const [presetStudentId, setPresetStudentId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const subjectIdParam = params.get('subjectId') || '';
    const studentIdParam = params.get('studentId') || '';
    setPresetSubjectId(subjectIdParam);
    setPresetStudentId(studentIdParam);
  }, [location.search]);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await subjectService.getTeachingSubjects();
        setSubjects(data || []);
        if (data && data.length > 0) {
          const preferred = presetSubjectId && data.some((subject) => subject.id === presetSubjectId)
            ? presetSubjectId
            : data[0].id;
          setSelectedSubjectId(preferred);
        }
      } catch (error) {
        console.error('Failed to load subjects:', error);
      }
    };

    loadSubjects();
  }, [presetSubjectId]);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const data = await studentService.getStudents(selectedSubjectId || undefined);
        const list = data || [];
        setStudents(list);
        if (presetStudentId) {
          setSelectedStudentId(presetStudentId);
        }
      } catch (error) {
        console.error('Failed to load students:', error);
        setStudents([]);
      }
    };

    loadStudents();
  }, [selectedSubjectId, presetStudentId]);

  useEffect(() => {
    const loadAssessments = async () => {
      setLoading(true);
      try {
        const data = selectedSubjectId
          ? await assessmentService.getAssessmentsBySubjectId(selectedSubjectId)
          : await assessmentService.getAssessments();
        setAssessments(data || []);
      } catch (error) {
        console.error('Failed to load assessments:', error);
        setAssessments([]);
      } finally {
        setLoading(false);
      }
    };

    loadAssessments();
  }, [selectedSubjectId]);

  const matchingStudents = useMemo(() => {
    const query = studentQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return fullName.includes(query) || (student.email || '').toLowerCase().includes(query);
    });
  }, [students, studentQuery]);

  useEffect(() => {
    const query = studentQuery.trim();
    if (!query) {
      if (!presetStudentId) {
        setSelectedStudentId('');
      }
      return;
    }
    if (matchingStudents.length === 1) {
      setSelectedStudentId(matchingStudents[0].id);
    } else if (matchingStudents.every((student) => student.id !== selectedStudentId)) {
      if (!presetStudentId) {
        setSelectedStudentId('');
      }
    }
  }, [studentQuery, matchingStudents, selectedStudentId, presetStudentId]);

  useEffect(() => {
    const loadResults = async () => {
      if (!selectedStudentId) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const rowsData = await Promise.all(
          assessments.map(async (assessment) => {
            const resultList = await assessmentService.getResults(assessment.id, selectedStudentId).catch(() => []);
            if (resultList.length === 0) return null;
            return {
              assessment,
              attempts: resultList.map((result) => ({
                actualMark: result.actualMark || 0,
                expectedMark: result.expectedMark || assessment.maxScore || 0,
                grade: result.grade,
                submittedDate: result.submittedDate ? new Date(result.submittedDate).toLocaleDateString() : undefined,
              })),
            } as StudentAssessmentRow;
          })
        );

        setRows(rowsData.filter(Boolean) as StudentAssessmentRow[]);
      } catch (error) {
        console.error('Failed to load student results:', error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [selectedStudentId, assessments]);

  const filteredRows = useMemo(() => {
    const query = assessmentQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const nameMatch = !query || (row.assessment.name || '').toLowerCase().includes(query);
      const typeRaw = ((row.assessment as any).assessmentType || row.assessment.type || '').toLowerCase();
      const typeMatch = selectedType === 'all' || typeRaw === selectedType;
      return nameMatch && typeMatch;
    });
  }, [rows, assessmentQuery, selectedType]);

  const summary = useMemo(() => {
    const attempted = rows.length;
    const allAttempts = rows.flatMap((row) => row.attempts);
    const totalScore = allAttempts.reduce((sum, attempt) => sum + (attempt.actualMark || 0), 0);
    const attemptCount = allAttempts.length;
    const averageScore = attempted > 0 ? totalScore / attempted : 0;
    const passed = allAttempts.filter((attempt) => {
      const expected = attempt.expectedMark || 0;
      if (expected > 0) {
        return attempt.actualMark >= expected * 0.5;
      }
      return (attempt.grade || '').toLowerCase() !== 'fail';
    }).length;
    const failed = attemptCount - passed;
    const passRate = attemptCount > 0 ? Math.round((passed / attemptCount) * 100) : 0;
    return { attempted, averageScore, passed, failed, passRate };
  }, [rows]);

  return (
    <div className="flex h-full bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        mode="assessments"
        onViewAssessments={() => navigate('/assessments/view')}
        onCreateAssessment={() => navigate('/assessments/create')}
        onMarkAssessment={() => navigate('/assessments/mark')}
        onAssessmentAnalysis={() => navigate('/assessments/analysis')}
        onStudentAnalysis={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        activeAction="analysis-student"
        recentUploads={[]}
      />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-5xl">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">Student Assessment Analysis</h1>
              <p className="text-sm text-gray-500">Track individual performance across assessments.</p>
            </div>
            <button
              onClick={() => navigate('/assessments/view')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Back to Assessments
            </button>
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">Subject</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Search student</label>
                <input
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Search student"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">Enter a full name or email to focus a student.</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 bg-slate-200 rounded animate-pulse" />
              ))}
            </div>
          ) : selectedStudentId ? (
            <>
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div className="bg-slate-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-500">Attempted</div>
                    <div className="font-semibold">{summary.attempted}</div>
                  </div>
                  <div className="bg-slate-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-500">Average</div>
                    <div className="font-semibold">{summary.averageScore.toFixed(1)}</div>
                  </div>
                  <div className="bg-slate-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-500">Passed</div>
                    <div className="font-semibold">{summary.passed}</div>
                  </div>
                  <div className="bg-slate-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-500">Failed</div>
                    <div className="font-semibold">{summary.failed}</div>
                  </div>
                  <div className="bg-slate-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-500">Pass rate</div>
                    <div className="font-semibold">{summary.passRate}%</div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-lg font-semibold mb-4">Assessments Attempted</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-gray-500">Search assessment</label>
                    <input
                      value={assessmentQuery}
                      onChange={(e) => setAssessmentQuery(e.target.value)}
                      placeholder="Search assessment name"
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Assessment Type</label>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="all">All</option>
                      <option value="quiz">Quiz</option>
                      <option value="assignment">Assignment</option>
                      <option value="test">Test</option>
                      <option value="project">Project</option>
                      <option value="exam">Exam</option>
                    </select>
                  </div>
                </div>

                {filteredRows.length === 0 ? (
                  <div className="text-sm text-gray-500">No assessment attempts found for this student.</div>
                ) : (
                  <div className="space-y-3">
                    {filteredRows.map((row) => (
                      <div key={row.assessment.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-gray-800">{row.assessment.name}</div>
                            <div className="text-xs text-gray-500">
                              {(row.assessment as any).assessmentType || row.assessment.type || 'Assessment'}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600">
                            Attempts: {row.attempts.length}
                          </div>
                          <button
                            onClick={() => setExpandedRows((prev) => ({ ...prev, [row.assessment.id]: !prev[row.assessment.id] }))}
                            className="text-blue-600 text-sm font-medium hover:text-blue-700"
                          >
                            {expandedRows[row.assessment.id] ? 'Hide attempts' : 'View attempts'}
                          </button>
                        </div>
                        {expandedRows[row.assessment.id] && (
                          <div className="border-t border-gray-100 pt-3 space-y-2">
                            {row.attempts.map((attempt, index) => (
                              <div key={`${row.assessment.id}-attempt-${index}`} className="flex flex-wrap items-center justify-between text-sm text-gray-600">
                                <div>Attempt {index + 1}{attempt.submittedDate ? ` • ${attempt.submittedDate}` : ''}</div>
                                <div>
                                  Score: {attempt.actualMark}/{attempt.expectedMark} • Grade: {attempt.grade || 'N/A'}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Assessments Attempted</h2>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Assessment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Attempts</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Latest Score</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gray-200">
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                        Search for a student to view assessment analysis.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentAnalysisPage;
