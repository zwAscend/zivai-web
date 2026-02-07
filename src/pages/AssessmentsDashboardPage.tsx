import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, FileText } from 'lucide-react';
import { assessmentService, studentService, subjectService } from '../services/api';
import { Assessment, Student, Subject } from '../types';
import Sidebar from '../components/resources/Sidebar';

interface AssessmentWithResult {
  assessment: Assessment;
  resultScore?: number;
  resultExpected?: number;
}

interface AssessmentMetrics {
  attempted: number;
  submitted: number;
  passed: number;
  failed: number;
  averageScore: number;
  passRate: number;
  aiReview: string;
}

const normalizeType = (assessment: Assessment) => {
  const raw: any = assessment as any;
  const type = raw.assessmentType || assessment.type || 'Test';
  const normalized = String(type).toLowerCase().replace(/\s+/g, '-');
  return normalized === 'homework' ? 'home-work' : normalized;
};

const AssessmentsDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [filtered, setFiltered] = useState<AssessmentWithResult[]>([]);
  const [metricsByAssessment, setMetricsByAssessment] = useState<Record<string, AssessmentMetrics>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [studentQuery, setStudentQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assessmentQuery, setAssessmentQuery] = useState('');

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await subjectService.getTeachingSubjects();
        setSubjects(data || []);
        if (data && data.length > 0) {
          setSelectedSubjectId(data[0].id);
        }
      } catch (error) {
        console.error('Failed to load subjects:', error);
      }
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const data = await studentService.getStudents(selectedSubjectId || undefined);
        setStudents(data || []);
      } catch (error) {
        console.error('Failed to load students:', error);
        setStudents([]);
      }
    };
    loadStudents();
  }, [selectedSubjectId]);

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

  useEffect(() => {
    const applyFilters = async () => {
      setLoading(true);
      try {
        let list = assessments;
        const assessmentSearch = assessmentQuery.trim().toLowerCase();
        if (assessmentSearch) {
          list = list.filter((item) =>
            (item.name || '').toLowerCase().includes(assessmentSearch)
          );
        }
        if (selectedType !== 'all') {
          list = list.filter((item) => normalizeType(item) === selectedType);
        }
        if (selectedStatus !== 'all' && selectedStatus !== 'marked') {
          list = list.filter((item) => (item.status || 'draft') === selectedStatus);
        }

        let results: AssessmentWithResult[] = list.map((item) => ({ assessment: item }));

        const metricsEntries = await Promise.all(
          list.map(async (item) => {
            const resultsList = await assessmentService.getResults(item.id).catch(() => []);
            const attempted = resultsList.length;
            const submitted = resultsList.length;
            const totalScore = resultsList.reduce((sum, result) => sum + (result.actualMark || 0), 0);
            const averageScore = attempted > 0 ? totalScore / attempted : 0;
            const passed = resultsList.filter((result) => {
              const expected = result.expectedMark ?? item.maxScore ?? 0;
              if (expected > 0) {
                return (result.actualMark || 0) >= expected * 0.5;
              }
              const grade = (result.grade || '').toLowerCase();
              return grade && !grade.includes('fail') && !grade.includes('f');
            }).length;
            const failed = attempted - passed;
            const passRate = attempted > 0 ? Math.round((passed / attempted) * 100) : 0;
            const aiReview = (item as any).isAIEnhanced || (item as any).aiEnhanced ? 'Enabled' : 'Disabled';
            return [
              item.id,
              {
                attempted,
                submitted,
                passed,
                failed,
                averageScore,
                passRate,
                aiReview,
              } as AssessmentMetrics,
            ] as const;
          })
        );

        const nextMetrics = Object.fromEntries(metricsEntries);
        setMetricsByAssessment(nextMetrics);

        if (selectedStatus === 'marked') {
          list = list.filter((item) => nextMetrics[item.id]?.attempted > 0);
          results = results.filter((item) => nextMetrics[item.assessment.id]?.attempted > 0);
        }

        if (selectedStudentId) {
          results = await Promise.all(
            list.map(async (item) => {
              const resultList = await assessmentService.getResults(item.id, selectedStudentId).catch(() => []);
              if (resultList.length === 0) return null;
              const result = resultList[0];
              return {
                assessment: item,
                resultScore: result.actualMark,
                resultExpected: result.expectedMark,
              };
            })
          ).then((items) => items.filter(Boolean) as AssessmentWithResult[]);
        }

        setFiltered(results);
      } catch (error) {
        console.error('Failed to filter assessments:', error);
        setFiltered([]);
      } finally {
        setLoading(false);
      }
    };

    applyFilters();
  }, [assessments, selectedType, selectedStatus, selectedStudentId, assessmentQuery]);

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
      setSelectedStudentId('');
      return;
    }
    if (matchingStudents.length === 1) {
      setSelectedStudentId(matchingStudents[0].id);
    } else {
      setSelectedStudentId('');
    }
  }, [studentQuery, matchingStudents]);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <Sidebar
        mode="assessments"
        onCreateAssessment={() => navigate('/assessments/create')}
        onMarkAssessment={() => navigate('/assessments/mark')}
        onViewAssessments={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        onAssessmentAnalysis={() => navigate('/assessments/analysis')}
        onStudentAnalysis={() => navigate('/assessments/student-analysis')}
        activeAction="view-assessments"
        recentUploads={[]}
      />
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Assessments</h1>
            <p className="text-sm text-gray-500">Create, view, and track assessments by subject or student.</p>
          </div>
          <button
            onClick={() => navigate('/grading')}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            <FileText className="h-4 w-4" />
            Open Reports
          </button>
        </header>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500">Search assessment</label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={assessmentQuery}
                  onChange={(e) => setAssessmentQuery(e.target.value)}
                  placeholder="Search assessment name"
                  className="w-full border border-gray-200 rounded-md pl-9 pr-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Search student</label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder="Search student"
                  className="w-full border border-gray-200 rounded-md pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">All students by default. Search will narrow to a single match.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <label className="text-xs text-gray-500">Assessment Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="quiz">Quiz</option>
                <option value="assignment">Assignment</option>
                <option value="home-work">Homework</option>
                <option value="test">Test</option>
                <option value="project">Project</option>
                <option value="exam">Exam</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
                <option value="marked">Marked</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Assessment List</h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Filter className="h-4 w-4" />
              {filtered.length} assessments
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-14 bg-slate-200 rounded animate-pulse" />
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map(({ assessment, resultScore, resultExpected }) => (
                <div key={assessment.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{assessment.name}</div>
                      <div className="text-xs text-gray-500">
                        {assessment.type || (assessment as any).assessmentType || 'Assessment'} • Status: {assessment.status || 'draft'}
                      </div>
                    </div>
                    {selectedStudentId && (
                      <div className="text-sm text-gray-600">
                        Score: {resultScore ?? 0}/{resultExpected ?? 0}
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => navigate(`/assessments/view/${assessment.id}`)}
                        className="text-blue-600 text-sm font-medium hover:text-blue-700"
                      >
                        View assessment
                      </button>
                      <button
                        onClick={() => navigate(`/assessments/analysis?assessmentId=${assessment.id}`)}
                        className="text-slate-600 text-sm font-medium hover:text-slate-800"
                      >
                        Analysis
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs text-gray-600">
                    <div className="bg-slate-50 rounded px-2 py-1">Attempted: {metricsByAssessment[assessment.id]?.attempted ?? 0}</div>
                    <div className="bg-slate-50 rounded px-2 py-1">Submitted: {metricsByAssessment[assessment.id]?.submitted ?? 0}</div>
                    <div className="bg-slate-50 rounded px-2 py-1">Passed: {metricsByAssessment[assessment.id]?.passed ?? 0}</div>
                    <div className="bg-slate-50 rounded px-2 py-1">Failed: {metricsByAssessment[assessment.id]?.failed ?? 0}</div>
                    <div className="bg-slate-50 rounded px-2 py-1">Average: {(metricsByAssessment[assessment.id]?.averageScore ?? 0).toFixed(1)}</div>
                    <div className="bg-slate-50 rounded px-2 py-1">Pass rate: {metricsByAssessment[assessment.id]?.passRate ?? 0}%</div>
                  </div>
                  <div className="text-xs text-gray-500">AI Review: {metricsByAssessment[assessment.id]?.aiReview ?? 'Disabled'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">No assessments found for the selected filters.</div>
          )}
        </div>
      </main>

    </div>
  );
};

export default AssessmentsDashboardPage;
